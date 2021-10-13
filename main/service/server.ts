import { IpcMain, clipboard } from 'electron';
import QRCode from 'qrcode';

import {
  MainService as MainServiceType,
  Config, Settings, ServiceResult
} from '../types/extention';
import { ProxyURI } from '../utils/ProxyURI';
import { startClient, stopClient, isConnected } from '../proxy';
import { createHttpServer, createHttpsServer } from '../proxy/http';

createHttpServer();
createHttpsServer();
// createHttpsServer2();

/* main service handler */
export class MainService implements MainServiceType {
  ipc: IpcMain

  constructor(ipc: IpcMain) {
    this.ipc = ipc;
  }

  async isConnected(): Promise<ServiceResult> {
    return Promise.resolve({
      code: 200,
      result: isConnected()
    });
  }

  async startClient(params: { config: Config, settings: Settings }): Promise<ServiceResult> {
    return startClient(params.config, params.settings);
  }

  async stopClient(): Promise<ServiceResult> {
    return new Promise((resolve) => {
      stopClient()
        .then(() => {
          resolve({
            code: 200,
            result: null
          });
        })
        .catch(error => {
          resolve({
            code: 500,
            result: error.toString()
          });
        })
    });
  }

  async parseClipboardText(params: { text: string }): Promise<ServiceResult> {
    const text = params.text || clipboard.readText('clipboard');
    const parsedInfo = ProxyURI.parse(text);
    const result: Config[] = parsedInfo.map(info => ({
      remark: info.remark || info.host,
      serverHost: info.host,
      serverPort: info.port,
      password: info.password || '',
      encryptMethod: info.authscheme,
      protocol: info.protocol || '',
      protocolParam: info.protocolParam || '',
      type: info.type as any,
      timeout: 60,
    }));
    return Promise.resolve({
      code: 200,
      result
    });
  }

  async generateUrlFromConfig(params: Config): Promise<ServiceResult> {
    let url: string = '';
    let result: {
      code: number
      result: {
        dataUrl: string
        url: string
        msg?: string
      }
    } = {
      code: 200,
      result: {
        dataUrl: '',
        url: '',
        msg: ''
      }
    };

    switch (params.type) {
      case 'ss':
        url = ProxyURI.generateSS(
          params.serverHost, params.serverPort, params.encryptMethod,
          params.password, params.remark, false
        );
        break;
      case 'ssr':
        url = ProxyURI.generateSSR(
          params.serverHost, params.serverPort, params.encryptMethod,
          params.password, params.remark
        );
        break;
      case 'http':
        break;
      default:
        break;
    }

    return new Promise((resolve) => {
      if (url) {
        result.result.url = url;
        QRCode.toDataURL(url, function (err, _dataURL) {
          if (!err) {
            result.result.dataUrl = _dataURL;
          } else {
            result.code = 500;
            result.result.msg = err.toString();
          }
          resolve(result);
        });
      } else {
        result.code = 500;
        result.result.msg = `Invalid Conf: ${JSON.stringify(params)}`;
        resolve(result);
      }
    });
  }

  async httpProxyTest() {
    // httpProxyRequest();
    return Promise.resolve();
  }

  async httpsProxyTest() {
    return Promise.resolve();
  }
}