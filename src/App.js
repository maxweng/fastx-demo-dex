import React, { Component } from 'react';
import { Switch, Route, Redirect } from 'react-router-dom'
import { Web3Provider } from 'react-web3';
import { connect } from 'react-redux'
import { bindActionCreators } from 'redux'

import {requireNetworkId, networkIds} from './config';
import Header from './containers/Header';
import SiteFooter from './components/SiteFooter';
import Deposit from './containers/Deposit';
import AssetList from './containers/AssetList';
import AssetDetail from './containers/AssetDetail';
import AssetSell from './containers/AssetSell';
import Account from './containers/Account';
import Exchange from './containers/Exchange';
import FlashMessage from './containers/FlashMessage';
import Wallet from './containers/Wallet';

import Web3 from 'web3'

import * as walletActions from './actions/wallet'

// window.addEventListener('load', function () {
//     if (typeof window.web3 !== 'undefined') {
//         window.web3 = new Web3(window.web3.currentProvider)
//     }
// });
if (window.web3) {
    // Then replace the old injected version by the local Web3.JS version 1.0.0-beta.N
    window.web3 = new Web3(window.web3.currentProvider);
}

function getCurNetId () {
    return window.web3.eth.net.getId()
}

class AppInitView extends Component {
    async componentDidMount() {
        if(typeof window.Web3 === 'undefined'){
            this.props.onLoadWallet()
        }

        const netId = await getCurNetId()
        if(netId != requireNetworkId){
            alert('请使用'+networkIds[requireNetworkId]['name']+'网络')
        }
    }

    render() {
        return ""
    }
}

function mapStateToProps(state){
    return {

    }
}

function mapDispatchToProps(dispatch) {
    return {
        onLoadWallet: () => {
            dispatch(walletActions.loadWallet())
        }
    }
}

const AppInit = connect(
    mapStateToProps,
    mapDispatchToProps
)(AppInitView)

export default class App extends Component {
  render() {
    let walletRoute
    let redirect = '/assets'
    let web3ProviderStrat,web3ProviderEnd
    let routes;
    if(typeof window.Web3 === 'undefined'){
        routes = <Switch>
                    <Route path='/account' component={Account} />
                    <Route exact path='/exchange' component={Exchange} />
                    <Route exact path='/assets' component={AssetList} />
                    <Route exact path='/assets/:category/:id' component={AssetDetail} />
                    <Route exact path='/assets/:category/:id/sell' component={AssetSell} />
                    <Route exact path='/deposit' component={Deposit} />
                    <Route exact path='/wallet' component={Wallet} />
                    <Redirect path="/" to={{pathname: '/wallet'}} />
                 </Switch>
    }else{
        routes = <Web3Provider>
                    <Switch>
                        <Route path='/account' component={Account} />
                        <Route exact path='/exchange' component={Exchange} />
                        <Route exact path='/assets' component={AssetList} />
                        <Route exact path='/assets/:category/:id' component={AssetDetail} />
                        <Route exact path='/assets/:category/:id/sell' component={AssetSell} />
                        <Route exact path='/deposit' component={Deposit} />
                        <Redirect path="/" to={{pathname: '/assets'}} />
                    </Switch>
                 </Web3Provider>
    }

    return (
        <div>
            <AppInit />
            <Header />
            <FlashMessage/>
            {routes}
            <SiteFooter />
        </div>
    );
  }
}
