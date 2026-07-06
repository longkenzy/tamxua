const os = require('os');
const net = require('net');

function getLocalSubnets() {
  const interfaces = os.networkInterfaces();
  const subnets = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        const parts = iface.address.split('.');
        if (parts.length === 4) {
          subnets.push({ name, address: iface.address, subnet: parts.slice(0, 3).join('.') });
        }
      }
    }
  }
  return subnets;
}

function probePrinter(ip, port = 9100, timeout = 600) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeout);

    socket.connect(port, ip, () => {
      socket.end();
      resolve({ ip, open: true });
    });

    socket.on('error', () => {
      socket.destroy();
      resolve({ ip, open: false });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ ip, open: false });
    });
  });
}

async function run() {
  console.log('Detecting subnets...');
  const subnets = getLocalSubnets();
  console.log('Subnets found:', subnets);
  
  if (subnets.length === 0) {
    console.log('No subnets found!');
    return;
  }
  
  const target = subnets[0];
  console.log(`Scanning subnet: ${target.subnet}.x on port 9100...`);
  
  const startTime = Date.now();
  const promises = [];
  for (let i = 1; i <= 254; i++) {
    promises.push(probePrinter(`${target.subnet}.${i}`, 9100, 800));
  }
  
  const results = await Promise.all(promises);
  const open = results.filter(r => r.open);
  
  console.log(`Scan completed in ${(Date.now() - startTime) / 1000}s`);
  console.log('Discovered devices:', open);
}

run();
