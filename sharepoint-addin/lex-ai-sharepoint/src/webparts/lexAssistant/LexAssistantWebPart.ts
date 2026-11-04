import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';

const bridgeOrigin = 'https://localhost:48765';

export default class LexAssistantWebPart extends BaseClientSideWebPart<Record<string, never>> {
  private panel?: HTMLIFrameElement;
  private companion: Window | null = null;
  private readonly onRequest = (event: MessageEvent): void => {
    if (event.origin !== bridgeOrigin || (!event.source || (event.source !== this.panel?.contentWindow && event.source !== this.companion)) ||
        event.data?.type !== 'lex.read-selection' || typeof event.data.id !== 'string') return;
    const selected = window.getSelection()?.toString() || '';
    (event.source as Window).postMessage({id:event.data.id, text:selected}, bridgeOrigin);
  };

  public render(): void {
    window.removeEventListener('message', this.onRequest);
    const frame = document.createElement('iframe');
    frame.title = 'LEX AI para SharePoint';
    frame.src = bridgeOrigin + '/sharepoint.html?tenant=' + encodeURIComponent(window.location.origin);
    frame.style.cssText = 'width:100%;height:640px;border:0';
    frame.allow = 'local-network-access https://localhost:48765; loopback-network https://localhost:48765';
    const open = document.createElement('button');
    open.type = 'button';
    open.textContent = 'Abrir LEX AI en una ventana del sitio';
    open.onclick = () => {
      this.companion = window.open(frame.src, '_blank', 'popup,width=540,height=720');
    };
    this.domElement.replaceChildren(open, frame);
    this.panel = frame;
    window.addEventListener('message', this.onRequest);
  }

  protected onDispose(): void {
    window.removeEventListener('message', this.onRequest);
    this.panel = undefined;
    super.onDispose();
  }
}
