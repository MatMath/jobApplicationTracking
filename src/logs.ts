import bunyan, {LogLevel} from 'bunyan';
import path from 'path';
import fs from 'fs';

const name = 'mongoExpress';

// Rotate the logs daily and keep 7 days.
const debugLogsLocation = path.join(__dirname, '../logs', 'debug.log');
const warnLogsLocation = path.join(__dirname, '../logs', 'warn.log');
if (!fs.existsSync(path.join(__dirname, '../logs'))) {
  console.log('DIRNAME:', __dirname);
  fs.mkdirSync(path.join(__dirname, '../logs'));
}
export const log = bunyan.createLogger({
  level: 'info',
  name,
  streams: [{
    level: 'debug',
    type: 'rotating-file',
    path: debugLogsLocation,
    period: '1d',
    count: 10,
  }, {
    level: 'info',
    stream: process.stdout,
  }, {
    level: 'warn',
    type: 'rotating-file',
    path: warnLogsLocation,
    period: '1d',
    count: 10,
  }],
});

export const getBunyanLog = (level:any) => {
  if (level === 'all') {
    const allLogs = fs.readFileSync(debugLogsLocation, 'utf8'); // fs.readFileSync will work until log reach 1G but that will never happen.
    let logsArray = allLogs.split('\n').filter(item => item.length > 5).reverse();
    logsArray = logsArray.map(line => JSON.parse(line)); // Extremely expensive but only run when the user ask for it.
    return logsArray.map(item => ({
      time: item.time,
      fnct: item.fnct,
      level: item.level,
      msg: item.msg,
      error: item.error,
    }));
  }
  if (level === 'info') {
    // TO get only the Flow (end user flow info)
    const allLogs = fs.readFileSync(debugLogsLocation, 'utf8');
    let logsArray = allLogs.split('\n').filter(item => item.length > 5).reverse();
    logsArray = logsArray.map(line => JSON.parse(line)); // Extremely expensive but only run when the user ask for it.
    return logsArray.filter(line => (line.level >= 30)).map((item) => {
      let itemLevel = 'Info';
      if (item.level === 40) {
        itemLevel = 'WARN';
      } else if (item.level >= 50) {
        itemLevel = 'ERROR';
      }
      return `${item.time} -> ${itemLevel}: ${item.msg}`;
    });
  }
  if (level === 'warn') {
    const allLogs = fs.readFileSync(warnLogsLocation, 'utf8');
    let logsArray = allLogs.split('\n').filter(item => item.length > 5).reverse();
    logsArray = logsArray.map(line => JSON.parse(line)); // Extremely expensive but only run when the user ask for it.
    return logsArray.map(item => ({
      time: item.time,
      fnct: item.fnct,
      level: item.level,
      msg: item.msg,
      error: item.error,
    }));
  }
  return 'No Log found or problem looking for them';
};
