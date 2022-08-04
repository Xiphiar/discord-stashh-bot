import "reflect-metadata";
import { Intents, Interaction, Message, MessageEmbed } from "discord.js";
import { Client } from "discordx";
import { dirname, importx } from "@discordx/importer";
import * as dotenv from 'dotenv';
// @ts-ignore
import storage from 'node-persist';
import { CosmWasmClient } from 'secretjs';
import { TwitterApi } from 'twitter-api-v2';
import Axios from 'axios';
import fs from 'fs';
dotenv.config();

const tokenInfo = [
  {
    address: 'secret1k0jntykt7e4g3y88ltc60czgjuqdy4c9e8fzek',
    symbol: "sSCRT",
    cashtag: "$SCRT",
    minimum: 99999999,  //uSCRT
    divisor: 10e5
  },
  {
    address: 'secret18wpjn83dayu4meu6wnn29khfkwdxs7kyrz9c8f',
    symbol: "sUSDT",
    cashtag: "$USDT",
    minimum: 99999999,  //uUSDT
    divisor: 10e5
  },
  {
    address: 'secret1wuzzjsdhthpvuyeeyhfq2ftsn3mvwf9rxy6ykw',
    symbol: "sETH",
    cashtag: "$ETH",
    minimum: 49999999999999999,  //gwei (?) 0.049999999999999999
    divisor: 10e17
  }
]

let twitterClient: TwitterApi;
if (process.env.TWITTER_APP_KEY) {
  twitterClient = new TwitterApi({
    // @ts-ignore
    appKey: process.env.TWITTER_APP_KEY,
    appSecret: process.env.TWITTER_APP_SECRET,
    accessToken: process.env.TWITTER_ACCESS_KEY,
    accessSecret: process.env.TWITTER_ACCESS_SECRET,
  });
}

if (!process.env.REST_URL) throw new Error('Please set REST_URL env variable.')
const queryJs = new CosmWasmClient(process.env.REST_URL);

const query = {
  collection_purchases: {
    nft_contract_address: "secret19syw637nl4rws0t9j5ku208wy8s2tvwqvyyhvu"
  }
}

const query2 = {
  listing_info: { }
}

const aliens = [635,2890,3100,3443,5822,5905,6089,7523,7804];
const apes = [372,5795,6915,5577,5217,8498,9280,1021,4464,6965,4178,8219,2491,6145,2924,4156,7191,2243,5314,2460,2140,2386,2711,9265];
const zombies = [8386,3831,5336,4472,4513,6491,4874,9203,4830,6704,5573,9804,3636,8553,6297,9474,5299,1526,2566,2132,4850,2560,5489,8909,1190,1748,6586,2424,8127,1119,6784,7337,6649,7252,7660,8531,9955,8957,5742,9838,5944,2681,9997,5312,6275,5066,7756,2338,987,8857,2967,3211,7014,3393,7458,1886,7121,3493,5761,117,2249,7914,2938,5253,8307,7127,2306,9909,2066,1658,5234,8472,9368,6515,4747,1478,6304,8780,1935,1374,3489,2329,2484,3609,5412,2708,3328,4559];

async function downloadImage(url: string, filepath: string) {
  const response = await Axios({
      url,
      method: 'GET',
      responseType: 'stream'
  });
  return new Promise((resolve, reject) => {
      response.data.pipe(fs.createWriteStream(filepath))
          .on('error', reject)
          .once('close', () => resolve(filepath)); 
  });
}

const exampleEmbed = new MessageEmbed()
	.setColor('#0099ff')
	.setTitle('Some title')
	.setURL('https://discord.js.org/')
	.setAuthor('Some name', 'https://i.imgur.com/AfFp7pu.png', 'https://discord.js.org')
	.setDescription('Some description here')
	.setThumbnail('https://i.imgur.com/AfFp7pu.png')
	.addFields(
		{ name: 'Regular field title', value: 'Some value here' },
		{ name: '\u200B', value: '\u200B' },
		{ name: 'Inline field title', value: 'Some value here', inline: true },
		{ name: 'Inline field title', value: 'Some value here', inline: true },
	)
	.addField('Inline field title', 'Some value here', true)
	.setImage('https://i.imgur.com/AfFp7pu.png')
	.setTimestamp()
	.setFooter('Some footer text here', 'https://i.imgur.com/AfFp7pu.png');

function getColor(id: string): string | boolean{
  if (aliens.includes(parseInt(id))){
    return '#c8fbfb'
  } 
  else if (apes.includes(parseInt(id))){
    return '#856f56'
  } 
  else if (zombies.includes(parseInt(id))){
    return '#7da269'
  }
  else {
    return false
  }
}

async function intervalFunc(channel: any) {
  try {
    //load last known sale height from persistent storage, will only announce sales after this height
    const lastKnownHeight = parseInt(await storage.getItem('lastKnownHeight') || 0);
    let newHeight: Number = lastKnownHeight;
    console.log("checking for sales from height ", lastKnownHeight)

    // @ts-ignore
    const saleInfo = await queryJs.queryContractSmart(process.env.STASHH_ADDRESS, query)
    if (!lastKnownHeight || lastKnownHeight==0) {
      console.log("No persistent data, will not announce old sales. New height: ", saleInfo.collection_purchases.history[0].block_height)
      await storage.setItem('lastKnownHeight',saleInfo.collection_purchases.history[0].block_height)
      return;
    }

    for (const sale of saleInfo.collection_purchases.history) {
      if (sale.block_height > lastKnownHeight){
        if (sale.block_height > newHeight){
          //update known block time with highest block
          newHeight = sale.block_height;
        }
        
        const listingInfo = await queryJs.queryContractSmart(sale.listing_address, query2);
        console.log(listingInfo.listing_info.sale_item.already_minted_nft.token_id, listingInfo.listing_info.price, listingInfo.listing_info.price / 10e5, listingInfo.listing_info.purchase_token.contract_address);
        
        //if listing was for whitelisted token and over the alert price
        const purchaseToken: string = listingInfo.listing_info.purchase_token.contract_address;
        const purchasePrice = listingInfo.listing_info.price;
        const tInfo = tokenInfo.find(token => token.address === purchaseToken);
        if (!tInfo) continue;

        // @ts-ignore
        if (parseInt(purchasePrice) > tInfo.minimum) {
          try {
            const punkID = listingInfo.listing_info.sale_item.already_minted_nft.token_id;
            const price = listingInfo.listing_info.price / tInfo.divisor;

            const msgColor: string | boolean = getColor(punkID)
            let punkEmbed = new MessageEmbed()
              .setTitle("Secret Punks on Stashh")
              .setURL(`https://stashh.io/asset/secret19syw637nl4rws0t9j5ku208wy8s2tvwqvyyhvu/${punkID}`)
              .setImage(listingInfo.listing_info.sale_item.already_minted_nft.nft_info.public_metadata.extension.image)
              .setDescription(`Punk ${punkID} was sold on Stashh`)
              //.setThumbnail(listingInfo.listing_info.sale_item.already_minted_nft.nft_info.public_metadata.extension.image)
              .addFields(
                { name: 'Price', value: `${price} ${tInfo.symbol}` },
                //{ name: 'New Owner', value: `Unknown` },
              )
              .setTimestamp()

            if (msgColor){
              // @ts-ignore
              punkEmbed.setColor(msgColor)
            }

            channel.send({ embeds: [punkEmbed] })

            if (twitterClient ) {

              //download image for twitter
              await downloadImage(listingInfo.listing_info.sale_item.already_minted_nft.nft_info.public_metadata.extension.image, "file2.png")

              //create and send tweet
              const mediaId = await twitterClient.v1.uploadMedia('./file2.png');
              const twitMsg = `Secret Punk ${punkID} just sold for ${price} ${tInfo.cashtag} on @StashhApp! #SecretPunks  https://stashh.io/asset/secret19syw637nl4rws0t9j5ku208wy8s2tvwqvyyhvu/${punkID}`
              await twitterClient.v1.tweet(twitMsg,{ media_ids: mediaId });
            }
          } catch(error) {
            console.error(error);
          }

        }

      }
    }

    if (newHeight > lastKnownHeight) {
      //save height of the latest sale to persistent storage
      await storage.setItem('lastKnownHeight', newHeight)
      console.log("Done, new height: ", newHeight)
    } else {
      console.log("Found no new sales after: ", lastKnownHeight)
    }
  } catch(error) {
    console.error(error);
  }
}


const client = new Client({
  simpleCommand: {
    prefix: "!",
  },
  intents: [
    Intents.FLAGS.GUILDS,
    /*Intents.FLAGS.GUILD_MEMBERS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
    Intents.FLAGS.GUILD_VOICE_STATES,
    */
  ],
  // If you only want to use global commands only, comment this line
  //botGuilds: [(client) => client.guilds.cache.map((guild) => guild.id)],

  silent: true,
});

client.once("ready", async () => {
  // make sure all guilds are in cache
  await client.guilds.fetch();

  // init all application commands
  await client.initApplicationCommands({
    guild: { log: true },
    global: { log: true },
  });

  // It stopped working but bot works without it 🤷
  // // init permissions; enabled log to see changes
  // await client.initApplicationPermissions(true);

  // uncomment this line to clear all guild commands,
  // useful when moving to global commands from guild commands
  //  await client.clearApplicationCommands(
  //    ...client.guilds.cache.map((g) => g.id)
  //  );
  console.log("Bot started");

  //initialize persistent storage
  await storage.init( /* options ... */ );

  //get channel to send announcements in
  // @ts-ignore
  const guild = client.guilds.cache.get(process.env.SERVER_ID);
  // @ts-ignore
  const channel = guild.channels.cache.get(process.env.CHANNEL_ID);

  //run at bot start
  intervalFunc(channel)

  //setup loop
  // @ts-ignore
  setInterval(function() {intervalFunc(channel)}, process.env.INTERVAL);

});

async function run() {
  // with cjs
  // await importx(__dirname + "/{events,commands}/**/*.{ts,js}");
  // with ems
  //await importx(dirname(import.meta.url) + "/{events,commands}/**/*.{ts,js}");
  client.login(process.env.BOT_TOKEN ?? ""); // provide your bot token
}

run();
