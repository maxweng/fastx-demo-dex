import { put, takeEvery, all ,take} from 'redux-saga/effects';
import '../api/plasma_js_client';
import { chainOptions } from '../config';
import erc721_abi from "../contract_data/ERC721Token.abi.json";
import moment from 'moment';
import axios from 'axios';

const fastx = new window.plasmaClient.client(chainOptions);

function* getBalanceAsync() {
    fastx.defaultAccount = fastx.web3.eth.defaultAccount;
    console.log('Account: ',fastx.defaultAccount);
    let utxos = yield fastx.getAllUTXO(fastx.defaultAccount);
    console.log('utxos:',utxos.data);
	const balance = yield fastx.getBalance(fastx.defaultAccount);
    console.log('balance:',balance);
	let wei = yield fastx.web3.eth.getBalance(fastx.defaultAccount);
	let ether = yield fastx.web3.utils.fromWei(wei, 'ether');

    yield put({
	  type: 'BALANCE_RECEIVED',
	  balance: parseFloat(parseFloat(ether).toFixed(4))
	})

    let assets = []
    for(let value of balance.data.result.NFT){
        let kittyRes = yield axios({
            method: 'get',
            url: 'https://api.cryptokitties.co/kitties/'+value[1]
        })
        let kitty = kittyRes.data;
        if(!kitty.auction)kitty.auction = {};
        // kitty.auction.discount = 0;
        // kitty.auction.ending_at = value.expiretimestamp;
        // kitty.auction.current_price = value.amount1.toString();
        // kitty.auction.starting_price = '0';
        assets.push(kitty);
    }

    yield put({
      type: 'USER_ITEMS_RECEIVED',
      items: assets
    })
}

function* getAccountAsync() {
	let address = fastx.web3.eth.defaultAccount;
    yield put({
	  type: 'ACCOUNT_RECEIVED',
	  ownerAddress: address
	})
}

const normalizeAddress = (address) => {
	if (!address) {
        throw new Error();
    }
    if ('0x' == address.substr(0,2)) {
        address = address.substr(2);
    }
    if (address == 0) address = '0'.repeat(40);
    return new Buffer(address, 'hex');
}

const depositNFT = async (asset_contract, token_id) => {
    console.log(asset_contract)

    const ownerAddress = fastx.defaultAccount;
    let nft_contract = new fastx.web3.eth.Contract( erc721_abi, asset_contract);

    // create a new token for testing
    const totalSupply = await nft_contract.methods.totalSupply().call();
    const tokenid = parseInt(totalSupply) + 10;
    console.log('Creating new token: '+tokenid);
    await nft_contract.methods.mint(ownerAddress, tokenid)
        .send({from: ownerAddress, gas: 3873385})
        .on('transactionHash', console.log);

    console.log('Approving token # '+tokenid+' to '+chainOptions.rootChainAddress);
    await fastx.approve(asset_contract, 0, tokenid, {from: ownerAddress})
        .on('transactionHash', console.log);
    console.log( 'Approved address: ', await nft_contract.methods.getApproved(tokenid).call() );

    await fastx.deposit(asset_contract, 0, tokenid, {from: ownerAddress});
    return {
        category: asset_contract, 
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
    let categoryContract = normalizeAddress(contract).toString('hex');
    console.log('from: '+from + ', contract: '+categoryContract+', tokenid: '+tokenid);

    let utxo = await fastx.searchUTXO({
        category: categoryContract, 
        tokenId: tokenid,
    }, { from: from });
    console.log('\nUTXO',utxo);
    const [_blknum, _txindex, _oindex, _contract, _balance, _tokenid] = utxo;

    return fastx.sendPsTransaction(
        _blknum, _txindex, _oindex, 
        from, '0'.repeat(40), price, 0, // sell for the price in eth
        _contract, 0, _tokenid, // sell the token
        0, end, null, from
    );
}

const postAd = async (data) => {
	const nft_ad = await depositNFT(data.params.categroy, data.params.sellId);
	await logBalance();
	const end = moment(data.params.end).add(1, 'days').unix();
	const price = parseFloat(data.params.sellPrice);
	await postNftAd(nft_ad.category, nft_ad.sellId, end, price);
}

function* watchSellAssetAsync(data) {
	// data = {
	// 	params: {
	// 		categroy: "0x952CE607bD9ab82e920510b2375cbaD234d28c8F",
	// 		end: '2018-06-13',
	// 		sellPrice: '1',
	// 		sellId: '283'
	// 	}
	// }
	console.log(data.params)
	postAd(data);
}

function* watchDepositAsync(action) {
    yield fastx.deposit("0x0", action.depositPrice, 0, { from: fastx.defaultAccount});
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

export const watchDeposit = function* () {
    yield takeEvery('DEPOSIT', watchDepositAsync)
}

