declare namespace google.picker {
  class PickerBuilder {
    addView(view: DocsView): PickerBuilder
    setOAuthToken(token: string): PickerBuilder
    setDeveloperKey(key: string): PickerBuilder
    setCallback(callback: (data: ResponseObject) => void): PickerBuilder
    enableFeature(feature: Feature): PickerBuilder
    setOrigin(origin: string): PickerBuilder
    setTitle(title: string): PickerBuilder
    build(): Picker
  }

  class DocsView {
    constructor(viewId?: ViewId)
    setMimeTypes(mimeTypes: string): DocsView
    setMode(mode: DocsViewMode): DocsView
  }

  interface Picker {
    setVisible(visible: boolean): void
    dispose(): void
  }

  interface ResponseObject {
    action: string
    docs: PickerDocument[]
  }

  interface PickerDocument {
    id: string
    name: string
    url: string
    mimeType: string
  }

  enum Action {
    CANCEL = 'cancel',
    PICKED = 'picked',
  }

  enum ViewId {
    DOCS = 'docs',
    DOCUMENTS = 'documents',
  }

  enum DocsViewMode {
    LIST = 'list',
    GRID = 'grid',
  }

  enum Feature {
    MULTISELECT_ENABLED = 'multiselectEnabled',
  }
}

interface Window {
  google?: {
    picker: typeof google.picker
  }
  gapi?: {
    load: (api: string, callback: () => void) => void
  }
}
