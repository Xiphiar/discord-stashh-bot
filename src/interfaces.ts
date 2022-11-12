export interface CollectionPurchasesQueryResponse {
    collection_purchases: {
        count: string;
        history: Sale[];
    }
}

export interface Sale {
    listing_address: string;
    block_height: number;
    block_time: number;
    quantity: number;
}