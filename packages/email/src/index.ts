export {
  renderBlocks,
  type EmailBlock,
  type EmailDetailRow,
  type EmailListItem,
} from './blocks'
export {
  DEFAULT_EMAIL_BRAND,
  EMAIL_COLORS,
  emailBrandFor,
  EMAIL_FONTS,
  escapeHtml,
  formatExpiryWindow,
  renderEmail,
  renderRichEmail,
  type EmailAction,
  type EmailBrand,
  type EmailLayoutArgs,
  type RichEmailLayoutArgs,
  type RenderedEmail,
} from './layout'
export {
  sendEmail,
  type OutboundEmail,
  type TransportConfig,
} from './transport'
export * from './templates/index'
export {
  AUTH_LINK_EXPIRY_MINUTES,
  portalDisplayName,
  renderAuthEmail,
  type AuthEmail,
  type PortalName,
} from './auth'
export { formatSender, quoteDisplayName } from './sender'
