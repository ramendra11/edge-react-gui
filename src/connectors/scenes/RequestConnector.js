// @flow

import type { EdgeCurrencyInfo, EdgeCurrencyWallet } from 'edge-core-js'
import { connect } from 'react-redux'

import { refreshReceiveAddressRequest, selectWalletFromModal } from '../../actions/WalletActions'
import { Request } from '../../components/scenes/RequestScene'
import type { RequestDispatchProps, RequestLoadingProps, RequestStateProps } from '../../components/scenes/RequestScene'
import * as CORE_SELECTORS from '../../modules/Core/selectors.js'
import type { Dispatch, State } from '../../modules/ReduxTypes'
import * as SETTINGS_SELECTORS from '../../modules/Settings/selectors.js'
import * as UI_SELECTORS from '../../modules/UI/selectors.js'
import type { GuiCurrencyInfo, GuiDenomination, GuiWallet } from '../../types'
import { getCurrencyInfo, getDenomFromIsoCode } from '../../util/utils'

const mapStateToProps = (state: State): RequestStateProps | RequestLoadingProps => {
  const guiWallet: GuiWallet = UI_SELECTORS.getSelectedWallet(state)
  const currencyCode: string = UI_SELECTORS.getSelectedCurrencyCode(state)

  const plugins: Object = SETTINGS_SELECTORS.getPlugins(state)
  const allCurrencyInfos: Array<EdgeCurrencyInfo> = plugins.allCurrencyInfos
  const currencyInfo: EdgeCurrencyInfo | void = getCurrencyInfo(allCurrencyInfos, currencyCode)

  if (!guiWallet || !currencyCode) {
    return {
      currencyCode: null,
      currencyInfo: null,
      edgeWallet: null,
      exchangeSecondaryToPrimaryRatio: null,
      guiWallet: null,
      loading: true,
      primaryCurrencyInfo: null,
      secondaryCurrencyInfo: null,
      showToWalletModal: null,
      publicAddress: '',
      legacyAddress: '',
      useLegacyAddress: null,
      currentScene: state.ui.scenes.currentScene,
      wallets: state.ui.wallets.byId
    }
  }

  const edgeWallet: EdgeCurrencyWallet = CORE_SELECTORS.getWallet(state, guiWallet.id)
  // $FlowFixMe
  const primaryDisplayDenomination: GuiDenomination = SETTINGS_SELECTORS.getDisplayDenomination(state, currencyCode)
  const primaryExchangeDenomination: GuiDenomination = UI_SELECTORS.getExchangeDenomination(state, currencyCode)
  const secondaryExchangeDenomination: GuiDenomination = getDenomFromIsoCode(guiWallet.fiatCurrencyCode)
  const secondaryDisplayDenomination: GuiDenomination = secondaryExchangeDenomination
  const primaryExchangeCurrencyCode: string = primaryExchangeDenomination.name
  const secondaryExchangeCurrencyCode: string = secondaryExchangeDenomination.name ? secondaryExchangeDenomination.name : ''

  const primaryCurrencyInfo: GuiCurrencyInfo = {
    displayCurrencyCode: currencyCode,
    displayDenomination: primaryDisplayDenomination,
    exchangeCurrencyCode: primaryExchangeCurrencyCode,
    exchangeDenomination: primaryExchangeDenomination
  }
  const secondaryCurrencyInfo: GuiCurrencyInfo = {
    displayCurrencyCode: guiWallet.fiatCurrencyCode,
    displayDenomination: secondaryDisplayDenomination,
    exchangeCurrencyCode: secondaryExchangeCurrencyCode,
    exchangeDenomination: secondaryExchangeDenomination
  }
  const isoFiatCurrencyCode: string = guiWallet.isoFiatCurrencyCode
  const exchangeSecondaryToPrimaryRatio = UI_SELECTORS.getExchangeRate(state, currencyCode, isoFiatCurrencyCode)

  return {
    currencyCode,
    currencyInfo: currencyInfo || null,
    edgeWallet,
    exchangeSecondaryToPrimaryRatio,
    guiWallet,
    publicAddress: guiWallet.receiveAddress.publicAddress || '',
    legacyAddress: guiWallet.receiveAddress.legacyAddress || '',
    loading: false,
    primaryCurrencyInfo,
    secondaryCurrencyInfo,
    showToWalletModal: state.ui.scenes.walletListModal.walletListModalVisible,
    useLegacyAddress: state.ui.scenes.requestType.useLegacyAddress,
    currentScene: state.ui.scenes.currentScene,
    wallets: state.ui.wallets.byId
  }
}
const mapDispatchToProps = (dispatch: Dispatch): RequestDispatchProps => ({
  refreshReceiveAddressRequest: (walletId: string) => {
    dispatch(refreshReceiveAddressRequest(walletId))
  },
  onSelectWallet: (walletId: string, currencyCode: string) => {
    dispatch(selectWalletFromModal(walletId, currencyCode))
  }
})

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(Request)
