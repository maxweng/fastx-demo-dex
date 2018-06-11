import { put, takeEvery, all ,take} from 'redux-saga/effects';
import '../api/plasma_js_client';
import { chainOptions } from '../config';
import erc721_abi from "../contract_data/ERC721Token.abi.json";
import moment from 'moment';

const fastx = new window.plasmaClient.client(chainOptions);
let nftContract = "";
console.log(fastx)
function* getBalanceAsync() {
	// const balance = yield fastx.getBalance("0x7a0C61EdD8b5c0c5C1437AEb571d7DDbF8022Be4")
	// console.log(balance)
	let wei = yield fastx.web3.eth.getBalance(fastx.web3.eth.defaultAccount);
	let ether = yield fastx.web3.utils.fromWei(wei, 'ether');
    yield put({
	  type: 'BALANCE_RECEIVED',
	  balance: parseFloat(parseFloat(ether).toFixed(4))
	})
}

function* getAccountAsync() {
	let address = fastx.web3.eth.defaultAccount;
    yield put({
	  type: 'ACCOUNT_RECEIVED',
	  ownerAddress: address
	})
}
const depositNFT = async (nftContract, tokenid) => {
	console.log(nftContract)
	let nft_contract = new fastx.web3.eth.Contract( erc721_abi, nftContract);
	let amount = 0;
    if(!tokenid) amount = 1;
	console.log(chainOptions.rootChainAddress)
    console.log(tokenid)
    console.log(fastx.web3.eth.defaultAccount)
    //await fastx.approve(nftContract, amount, tokenid, {from: fastx.web3.eth.defaultAccount})
    await nft_contract.methods.approve(chainOptions.rootChainAddress, tokenid != 0? tokenid: amount)
        .send({from: fastx.web3.eth.defaultAccount})
        .on('transactionHash', 
        	(hash) => {
                console.log(hash);
            }
        );
    console.log( 'New owner address: ', await nft_contract.methods.ownerOf(tokenid).call() );
    
    await fastx.deposit(nftContract, amount, tokenid, {from: fastx.web3.eth.defaultAccount});
    console.log('return')
    return {
        category: nftContract, 
        tokenId: tokenid
    };
}

const logBalance = async (address) => {
	let res = (await fastx.getBalance(address)).data.result;
    console.log("\naddress: "+ (address || fastx.defaultAccount) );
    console.log("balance: ", res);
}

const postNftAd = async (contract, tokenid, end, price, options={}) => {
	let from = options.from || fastx.defaultAccount;
    let categoryContract = fastx.normalizeAddress(contract).toString('hex');
    console.log('from: '+from + ', contract: '+categoryContract+', tokenid: '+tokenid);

    let utxos = (await fastx.getUTXO(from)).data.result;

    let utxo;
    for(let i in utxos){
        utxo = utxos[utxos.length - i - 1];
        const [_blknum, _txindex, _oindex, _contract, _balance, _tokenid] = utxo;
        if ( categoryContract == _contract && tokenid == _tokenid ) {
            console.log(_blknum, _txindex, _oindex, _contract, _balance, _tokenid);
            return fastx.sendPsTransaction(
                _blknum, _txindex, _oindex, 
                from, '0'.repeat(40), price, 0, // sell for the price in eth
                _contract, 0, _tokenid, // sell the token
                0, end
            );
        }
    }
}

const postAd = async (data) => {
	const nft_ad = await depositNFT(data.params.categroy, data.params.sellId);
	console.log(nft_ad)
	// await logBalance();
	// const end = moment(data.params.end).add(1, 'days').unix();
	// const price = parseFloat(data.params.sellPrice);
	// await postNftAd(nft_ad.category, nft_ad.tokenId, end, price);
}

function* watchSellAssetAsync(data) {
	data = {
		params: {
			categroy: '0x40eb59a8cc2d865baf536dd9d0ec3108934afced',
			end: '2018-06-13',
			sellPrice: '2',
			sellId: '283'
		}
	}
	console.log(data.params)
	postAd(data);
}

export const watchGetBalanceAsync = function* () {
    yield takeEvery('GET_BALANCE', getBalanceAsync)
}

export const watchGetAccount = function* () {
    yield takeEvery('GET_ACCOUNT', getAccountAsync)
}

export const watchSellAsset = function* () {
    yield takeEvery('SELL_ASSET', watchSellAssetAsync)
}