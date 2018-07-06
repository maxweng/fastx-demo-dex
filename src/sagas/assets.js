import { put, takeEvery, all ,take} from 'redux-saga/effects';
import { delay } from 'redux-saga';
import axios from 'axios';
import { chainOptions, retry, chainCategory} from '../config';

let store,fastx;

const allPsTransactions = async () => {
    let allPsRes;
    try{
        allPsRes = await fastx.getAllPsTransactions();
        console.log('allPsRes:',allPsRes)
        return allPsRes.data.result;
    }catch(e) {
        console.log('allPsTransactionsError',e)
        return [];
    }
}

function* getAccountAsync() {
    yield getFastx();
    let accounts = [];
    for (let i = 1; i<=retry.count; i++){
        try {
            accounts = yield fastx.web3.eth.getAccounts();
            break;
        }catch(err){
            if(i <= retry.count) {
                console.log("getAccountErr:",i,err)
                yield delay(retry.time);
            }else{
                throw new Error('getAccount request failed');
            }
        }
    }

    fastx.defaultAccount = accounts[0];
    console.log('getAccountAddress:',fastx.defaultAccount);
    yield put({
      type: 'ACCOUNT_RECEIVED',
      ownerAddress: accounts[0]
    })
}

function* getAssetsAsync(params) {
    yield getFastx();

    let assets = [];
    yield put({
      type: 'SET_ASSETS_LOADING',
      isLoading: true
    })

    let allPs = yield allPsTransactions();
    yield put({
      type: 'ALLPS_RECEIVED',
      allPs: allPs
    })

    for(let value of allPs){
        let kittyRes = {};
        try {
            kittyRes = yield axios({
                method: 'get',
                url: 'https://api.cryptokitties.co/kitties/'+value.tokenid2
            })
        } catch (error) {
            return yield put({ type: 'ASSET_CATEGORIES_REQUEST_FAILED', error })
        }
        let kitty = kittyRes.data;
        if(!kitty.auction)kitty.auction = {};
        kitty.auction.discount = 0;
        kitty.auction.ending_at = value.expiretimestamp;
        kitty.auction.current_price = value.amount1.toString();
        kitty.auction.starting_price = '0';
        kitty.categroy = value.contractaddress2;
        assets.push(kitty);
    }

    yield put({
	  type: 'ASSETS_RECEIVED',
	  results: assets
	})

    yield put({
      type: 'SET_ASSETS_LOADING',
      isLoading: false
    })
}

function* getAssetsDetailAsync(action) {
    yield getFastx();
    yield put({
      type: 'SET_ASSETS_LOADING',
      isLoading: true
    })

    let kittyRes = {};
    try {
        kittyRes = yield axios({
            method: 'get',
            url: 'https://api.cryptokitties.co/kitties/'+action.id
        })
    } catch (e) {
        console.log('getAssetsDetailError:',e)
        return yield put({ type: 'ASSET_CATEGORIES_REQUEST_FAILED', e })
    }

    let kitty = kittyRes.data;
    if(!kitty.auction)kitty.auction = {};
    kitty.auction.discount = 0;
    kitty.auction.ending_at = 1528905600;
    kitty.auction.current_price = '0';
    kitty.auction.starting_price = '0';

    let allPs = yield allPsTransactions();
    yield put({
      type: 'ALLPS_RECEIVED',
      allPs: allPs
    })

    yield put({
      type: 'ASSET_DETAIL_RECEIVED',
      asset: kitty
    })

    yield put({
      type: 'SET_ASSETS_LOADING',
      isLoading: false
    })
}

const bidAd = async (category,tokenId,fillTx) => {
    let receiverAddress = fastx.defaultAccount;
    console.log('receiverAddress',receiverAddress);

    let utxo = await fastx.getOrNewEthUtxo(fillTx.amount1, {from:fastx.defaultAccount})
    console.log('utxo:',utxo);

    if (utxo.length > 0) {
        const [_blknum, _txindex, _oindex, _contract, _balance, _tokenid] = utxo;
        let res = await fastx.sendPsTransactionFill(fillTx, _blknum, _txindex, _oindex, receiverAddress, receiverAddress);
        console.log(res);
    }
}

function* assetBuyAsync(action) {
    yield getFastx();
    yield put({
      type: 'DEPOSIT_STATUS',
      waiting: false
    })

    try{
        yield bidAd(action.category, action.id, action.fillTx);
    }catch(err){
        console.log("bidAd:",err);
        yield put({
          type: 'BID_AD_ERROR',
          error: err
        })
        return;
    }

    yield put({
      type: 'DEPOSIT_STATUS',
      waiting: true
    })
}

function* publishStatusAsync(action) {
    yield getFastx();
    let allPs = yield allPsTransactions();
    let hasPublished = false;
    for(let value of allPs){
        if(value.contractaddress2 == action.category && value.tokenid2 == action.id)hasPublished = true;
    }
    yield put({
      type: 'SET_PUBLISH_STATUS',
      hasPublished
    })
}

async function checkFastxOwner(action) {
    let balanceFT = [],balanceNFT = [],utxos,balanceRes;
    balanceRes = await fastx.getBalance(fastx.defaultAccount);
    console.log('balanceRes:',balanceRes);
    balanceFT = balanceRes.FT;
    balanceNFT = balanceRes.NFT
    for(let value of balanceNFT){
        if(value[0] == action.category && value[1] == action.id){
            return true;
        }
    }

    return false
}

async function checkEthOwner (action) {
    const contract = fastx.getErc721TokenInterface(chainCategory);
    let tokenIndex = await contract.methods.balanceOf(fastx.defaultAccount).call();
    tokenIndex = parseInt(tokenIndex);
    while(tokenIndex > 0){
        tokenIndex--;
        let token = await contract.methods.tokenOfOwnerByIndex(fastx.defaultAccount, tokenIndex).call();
        if(action.id == token)return true;
    }

    return false
}

function* watchCheckOwnerAsync(action) {
    yield getFastx();
    yield getAccountAsync();
    let isOwner = false;
    // let currency = store.getState().account.currency;

    // let allPs = yield allPsTransactions();
    // let inFastX = false;
    // for(let ps of allPs){
    //     if(action.id == ps.tokenid2)inFastX = true;
    // }
    if(action.locationParams){
        isOwner = yield checkEthOwner(action);
    }else{
        isOwner = yield checkFastxOwner(action);
    }
    // switch(currency){
    //     case 'Ethereum':
    //         isOwner = yield checkEthOwner(action);
    //         break;
    //     case 'FastX':
    //     default:
    //         isOwner = yield checkFastxOwner(action);
    // }

    yield put({
      type: 'SET_ASSETS_IS_OWNER',
      isOwner: isOwner
    })
}

function* watchCheckBlanceEnough(action) {
    yield getFastx();
    yield getAccountAsync();
    let receiverAddress = fastx.defaultAccount;
    yield put({
      type: 'BALNCE_ENOUGH',
      blanceEnough: true
    })

    try{
        yield fastx.getOrNewEthUtxo(action.amount, {from:fastx.defaultAccount})
    }catch(err) {
        console.log("CheckBlanceEnough:",err);
        yield put({
          type: 'BID_AD_ERROR',
          error: err
        })
        if(err == "Error: Not enough balance"){
            yield put({
              type: 'BALNCE_ENOUGH',
              blanceEnough: false
            })
        }
    }
}

const depositNFT = async (asset_contract, tokenid) => {
    console.log('asset_contract:',asset_contract)
    const ownerAddress = fastx.defaultAccount;
    let nft_contract = fastx.getErc721TokenInterface(asset_contract);

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

function* watchTakeOutAsync(action) {
    yield getFastx();
    try{
        if(action.currency == 'FastX'){
            let utxo = yield fastx.searchUTXO({'category':action.category,'tokenId':action.id})
            console.log(utxo)
            const [blknum, txindex, oindex, contractAddress, amount, tokenid] = utxo;
            yield fastx.startExit(blknum, txindex, oindex, contractAddress, amount, tokenid, {from:fastx.defaultAccount});
        }else if(action.currency == 'Ethereum'){
            const nft_ad = yield depositNFT(action.category, action.id);
        }
    }catch(err){
        console.log(err);
    }
}

async function getFastx(func) {
    while(!fastx) {
        fastx = store.getState().app.fastx;
        await delay(200);
    }

    return true;
}

export default function * assetSaga (arg) {
    store = arg;
    yield takeEvery('GET_ASSETS', getAssetsAsync)
    yield takeEvery('GET_ASSET_DETAIL', getAssetsDetailAsync)
    yield takeEvery('SET_ASSETS_FILTER', getAssetsAsync)
    yield takeEvery('ASSETS_SEARCH', getAssetsAsync)
    yield takeEvery('ASSETS_BUY', assetBuyAsync)
    yield takeEvery('GET_PUBLISH_STATUS',publishStatusAsync)
    yield takeEvery('CHECK_IS_OWNER', watchCheckOwnerAsync)
    yield takeEvery('CHECK_BLANCE_ENOUGH', watchCheckBlanceEnough)
    yield takeEvery('TAKE_OUT', watchTakeOutAsync)
}
