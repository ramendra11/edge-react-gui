// @flow

import React from 'react'
import { Platform } from 'react-native'
import RNFS from 'react-native-fs'
import { Actions } from 'react-native-router-flux'
import { WebView } from 'react-native-webview'
import { connect } from 'react-redux'
import { Bridge, onMethod } from 'yaob'

import ENV from '../../../env.json'
import { javascript } from '../../lib/bridge/injectThisInWebView.js'
import type { Dispatch, State } from '../../modules/ReduxTypes'
import Gradient from '../../modules/UI/components/Gradient/Gradient.ui'
import SafeAreaView from '../../modules/UI/components/SafeAreaView/index'
import { setPluginScene } from '../../modules/UI/scenes/Plugins/BackButton.js'
import { EdgeProvider } from '../../modules/UI/scenes/Plugins/EdgeProvider.js'
import styles from '../../styles/scenes/PluginsStyle.js'
import type { BuySellPlugin } from '../../types.js'

// WebView bridge managemer --------------------------------------------

type WebViewCallbacks = {
  onMessage: Function,
  setRef: Function
}

/**
 * Sets up a YAOB bridge for use with a React Native WebView.
 * The returned callbacks should be passed to the `onMessage` and `ref`
 * properties of the WebView. Handles WebView reloads and related
 * race conditions.
 * @param {*} onRoot Called when the inner HTML sends a root object.
 * May be called multiple times if the inner HTML reloads.
 * @param {*} debug Set to true to enable logging.
 */
function makeOuterWebViewBridge<Root> (onRoot: (root: Root) => mixed, debug: boolean = false): WebViewCallbacks {
  let bridge: Bridge | void
  let gatedRoot: Root | void
  let webview: WebView | void

  // Gate the root object on the webview being ready:
  const tryReleasingRoot = () => {
    if (gatedRoot != null && webview != null) {
      onRoot(gatedRoot)
      gatedRoot = void 0
    }
  }

  // Feed incoming messages into the YAOB bridge (if any):
  const onMessage = event => {
    const message = JSON.parse(event.nativeEvent.data)
    if (debug) console.info('plugin →', message)

    // This is a terrible hack. We are using our inside knowledge
    // of YAOB's message format to determine when the client has restarted.
    if (bridge != null && message.events != null && message.events.find(event => event.localId === 0)) {
      bridge.close(new Error('plugin: The WebView has been unmounted.'))
      bridge = void 0
    }

    // If we have no bridge, start one:
    if (bridge == null) {
      let firstMessage = true
      bridge = new Bridge({
        sendMessage: message => {
          if (debug) console.info('plugin ←', message)
          if (webview == null) return

          const js = `if (window.bridge != null) {${
            firstMessage ? 'window.gotFirstMessage = true;' : 'window.gotFirstMessage && '
          } window.bridge.handleMessage(${JSON.stringify(message)})}`
          firstMessage = false
          webview.injectJavaScript(js)
        }
      })

      // Use our inside knowledge of YAOB to directly
      // subscribe to the root object appearing:
      onMethod.call(bridge._state, 'root', root => {
        gatedRoot = root
        tryReleasingRoot()
      })
    }

    // Finally, pass the message to the bridge:
    try {
      bridge.handleMessage(message)
    } catch (e) {
      console.warn('plugin bridge error: ' + String(e))
    }
  }

  // Listen for the webview component to mount:
  const setRef = element => {
    webview = element
    tryReleasingRoot()
  }

  return { onMessage, setRef }
}

// Plugin scene --------------------------------------------------------

type Props = {
  dispatch: Dispatch,
  plugin: BuySellPlugin,
  state: State
}

type PluginWorkerApi = {
  isFirstPage: boolean,
  setEdgeProvider(provider: EdgeProvider): mixed
}

class PluginView extends React.Component<Props> {
  _callbacks: WebViewCallbacks
  _edgeProvider: EdgeProvider
  webview: WebView | void

  constructor (props) {
    super(props)
    setPluginScene(this)

    let firstRun: boolean = true

    // Set up the plugin:
    const { dispatch, plugin, state } = this.props
    plugin.environment.apiKey = ENV.PLUGIN_API_KEYS ? ENV.PLUGIN_API_KEYS[plugin.name] : 'edgeWallet' // latter is dummy code

    // Set up the EdgeProvider:
    this._edgeProvider = new EdgeProvider(plugin.pluginId, state, dispatch)

    // Set up the WebView bridge:
    this._callbacks = makeOuterWebViewBridge((root: PluginWorkerApi) => {
      console.log('we got a worker!')
      root.setEdgeProvider(this._edgeProvider).catch(e => {
        console.warn('plugin setEdgeProvider error: ' + String(e))
      })
      if (root.isFirstPage) {
        console.log('this is the first page!')
        if (firstRun) {
          const js = `document.location = ${JSON.stringify(plugin.sourceFile.uri)}`
          if (this.webview) this.webview.injectJavaScript(js)
          firstRun = false
        } else {
          Actions.pop()
        }
      }
    }, true)

    // Capture the WebView ref:
    const { setRef } = this._callbacks
    this._callbacks.setRef = (element: WebView | void) => {
      this.webview = element
      setRef(element)
    }
  }

  UNSAFE_componentWillReceiveProps (nextProps: Props) {
    this._edgeProvider.updateState(nextProps.state)
  }

  render () {
    const uri = Platform.OS === 'android' ? 'file:///android_asset/blank.html' : `file://${RNFS.MainBundlePath}/blank.html`

    console.log('redering plugin')

    return (
      <SafeAreaView>
        <Gradient style={styles.gradient} />
        <WebView
          allowFileAccess
          allowUniversalAccessFromFileURLs
          geolocationEnabled
          injectedJavaScript={javascript}
          javaScriptEnabled={true}
          onMessage={this._callbacks.onMessage}
          originWhitelist={['file://', 'https://', 'http://', 'edge://']}
          ref={this._callbacks.setRef}
          setWebContentsDebuggingEnabled={true}
          source={{ uri }}
          userAgent={
            'Mozilla/5.0 (Linux; Android 6.0.1; SM-G532G Build/MMB29T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.83 Mobile Safari/537.36 edge/app.edge.' +
            Platform.OS
          }
          useWebKit
        />
      </SafeAreaView>
    )
  }
}

// Connector -----------------------------------------------------------

const mapStateToProps = state => ({ state })
const mapDispatchToProps = dispatch => ({ dispatch })

export const PluginViewConnect = connect(
  mapStateToProps,
  mapDispatchToProps
)(PluginView)
