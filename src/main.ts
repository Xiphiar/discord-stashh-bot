import "reflect-metadata";
import { Intents, Interaction, Message, MessageEmbed } from "discord.js";
import { Client } from "discordx";
import { dirname, importx } from "@discordx/importer";
import dotenv from 'dotenv';

import { CosmWasmClient } from 'secretjs';
dotenv.config()

const queryJs = new CosmWasmClient(process.env.REST_URL);

var lastKnownHeight = 0;

const query = {
  collection_purchases: {
    nft_contract_address: "secret19syw637nl4rws0t9j5ku208wy8s2tvwqvyyhvu"
  }
}

const aliens = [635,2890,3100,3443,5822,5905,6089,7523,7804];
const apes = [372,5795,6915,5577,5217,8498,9280,1021,4464,6965,4178,8219,2491,6145,2924,4156,7191,2243,5314,2460,2140,2386,2711,9265];
const zombies = [8386,3831,5336,4472,4513,6491,4874,9203,4830,6704,5573,9804,3636,8553,6297,9474,5299,1526,2566,2132,4850,2560,5489,8909,1190,1748,6586,2424,8127,1119,6784,7337,6649,7252,7660,8531,9955,8957,5742,9838,5944,2681,9997,5312,6275,5066,7756,2338,987,8857,2967,3211,7014,3393,7458,1886,7121,3493,5761,117,2249,7914,2938,5253,8307,7127,2306,9909,2066,1658,5234,8472,9368,6515,4747,1478,6304,8780,1935,1374,3489,2329,2484,3609,5412,2708,3328,4559];
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

function getColor(id): string{
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
    return '#949494'
  }
}

async function intervalFunc(channel) {

  console.log("checking for sales from height ", lastKnownHeight)
  const saleInfo = await queryJs.queryContractSmart(process.env.STASHH_ADDRESS, query)
  if (lastKnownHeight==0) {
    //lastKnownHeight = saleInfo.collection_purchases.history[0].block_height;
    //return;
  }

  for (const sale of saleInfo.collection_purchases.history) {
    if (sale.block_height > lastKnownHeight){
      console.log(sale.listing_address);
      let query2 = {
        listing_info: { }
      }
      const listingInfo = await queryJs.queryContractSmart(sale.listing_address, query2);
      console.log(listingInfo.listing_info.sale_item.already_minted_nft.token_id, listingInfo.listing_info.price, listingInfo.listing_info.price / 10e5, listingInfo.listing_info.purchase_token.contract_address);
      console.log(process.env.ALERT_PRICE)
      if (listingInfo.listing_info.purchase_token.contract_address.includes("secret1k0jntykt7e4g3y88ltc60czgjuqdy4c9e8fzek") && (parseInt(listingInfo.listing_info.price) > parseInt(process.env.ALERT_PRICE)) ) {
        const punkID = listingInfo.listing_info.sale_item.already_minted_nft.token_id;
        const price = listingInfo.listing_info.price / 10e5;
        //channel.send(`Punk ${punkID} sold for ${price} SCRT on Stashh https://stashh.io/asset/secret19syw637nl4rws0t9j5ku208wy8s2tvwqvyyhvu/${punkID}`)

        const punkEmbed = new MessageEmbed()
          .setColor(getColor(punkID))
          .setTitle("Secret Punks on Stashh")
          .setURL(`https://stashh.io/asset/secret19syw637nl4rws0t9j5ku208wy8s2tvwqvyyhvu/${punkID}`)
          .setImage(listingInfo.listing_info.sale_item.already_minted_nft.nft_info.public_metadata.extension.image)
          .setDescription(`Punk ${punkID} was sold on Stashh`)
          //.setThumbnail(listingInfo.listing_info.sale_item.already_minted_nft.nft_info.public_metadata.extension.image)
          .addFields(
            { name: 'Price', value: `${price} SCRT` },
          )
          .setTimestamp()
        channel.send({ embeds: [punkEmbed] })
      }

    }
  }
  lastKnownHeight = saleInfo.collection_purchases.history[0].block_height;
  console.log("Done, new height: ", saleInfo.collection_purchases.history[0].block_height)
}


const client = new Client({
  simpleCommand: {
    prefix: "!",
  },
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MEMBERS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
    Intents.FLAGS.GUILD_VOICE_STATES,
  ],
  // If you only want to use global commands only, comment this line
  botGuilds: [(client) => client.guilds.cache.map((guild) => guild.id)],
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

  // init permissions; enabled log to see changes
  await client.initApplicationPermissions(true);

  // uncomment this line to clear all guild commands,
  // useful when moving to global commands from guild commands
  //  await client.clearApplicationCommands(
  //    ...client.guilds.cache.map((g) => g.id)
  //  );
  console.log("Bot started");
});

client.on("interactionCreate", (interaction: Interaction) => {
  client.executeInteraction(interaction);
});

client.on("messageCreate", (message: Message) => {
  client.executeCommand(message);
});

client.on("ready", () => {
  const guild = client.guilds.cache.get('894435040551915530');
  const channel = guild.channels.cache.get('894435040551915533');
  intervalFunc(channel)
  setInterval(function() {intervalFunc(channel)}, 120000);
  //channel.send('Your message')
});

async function run() {
  // with cjs
  // await importx(__dirname + "/{events,commands}/**/*.{ts,js}");
  // with ems
  await importx(dirname(import.meta.url) + "/{events,commands}/**/*.{ts,js}");
  client.login(process.env.BOT_TOKEN ?? ""); // provide your bot token
}

run();
