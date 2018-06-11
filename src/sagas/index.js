import { put, takeEvery, all, fork } from 'redux-saga/effects'

export default function* rootSaga() {
  yield all([
  	fork(require('./assets').watchGetAssetsAsync),
  	fork(require('./assets').watchSetAssetsFilterAsync),
  	fork(require('./assets').watchSearchAssetsTitleAsync),
  	fork(require('./account').watchGetBalanceAsync),
  	fork(require('./account').watchGetAccount),
  	fork(require('./account').watchSellAsset)
  ])
}