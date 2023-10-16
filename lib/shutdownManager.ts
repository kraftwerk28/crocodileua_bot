import util from 'util';
import { noop } from './utils';
import { logger } from './log';

const log = logger.child({ module: 'shutdownManager' });

type AsyncFunc = () => Promise<any>;
type CbFunc = (err: any, ...args: any[]) => any;

export class ShutdownManager {
  private callbacks: (() => Promise<any>)[];
  constructor(signals = ['SIGINT', 'SIGTERM']) {
    this.callbacks = [];
    signals.forEach((s) => {
      process.on(s as any, () => {
        Promise.all(this.callbacks)
          .then(() => {
            log.info('\n\nFinished graceful shutdown.');
            process.exit(0);
          })
          .catch((e) => {
            console.error(e);
            process.exit(1);
          });
      });
    });
  }
  // TODO: register post-callback
  register(cb: AsyncFunc | CbFunc, afterCb = noop) {
    this.callbacks.push(
      cb.constructor.name === 'AsyncFunction'
        ? (cb as AsyncFunc)
        : util.promisify(cb),
    );
  }
}
