const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const pngPath = path.join(__dirname, '../public/images/logo.png');
const icoPath = path.join(__dirname, '../public/images/logo.ico');
const batPath = path.join(__dirname, '../start.vbs');
const shortcutPath = path.join(__dirname, '../Tam Xua Order.lnk');

function convertPngToIco(pngBuf) {
  // Check PNG signature
  if (pngBuf.readUInt32BE(0) !== 0x89504E47 || pngBuf.readUInt32BE(4) !== 0x0D0A1A0A) {
    throw new Error('File khong phai la PNG hop le');
  }

  // Read width and height from PNG IHDR chunk (starts at offset 16, big endian 32-bit)
  const width = pngBuf.readUInt32BE(16);
  const height = pngBuf.readUInt32BE(20);

  console.log(`Phat hien logo size: ${width}x${height}`);

  // Create 6-byte ICO Header
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type: 1 = Icon
  header.writeUInt16LE(1, 4); // Count: 1 image

  // Create 16-byte Directory Entry
  const entry = Buffer.alloc(16);
  // Width/height (0 means 256)
  entry.writeUInt8(width >= 256 ? 0 : width, 0);
  entry.writeUInt8(height >= 256 ? 0 : height, 1);
  entry.writeUInt8(0, 2); // Color palette (0 = no palette)
  entry.writeUInt8(0, 3); // Reserved
  entry.writeUInt16LE(1, 4); // Color planes
  entry.writeUInt16LE(32, 6); // Bits per pixel (32-bit color)
  entry.writeUInt32LE(pngBuf.length, 8); // Size of PNG data
  entry.writeUInt32LE(22, 12); // Offset of PNG data (6 bytes header + 16 bytes entry = 22)

  return Buffer.concat([header, entry, pngBuf]);
}

try {
  if (!fs.existsSync(pngPath)) {
    console.error(`Khong tim thay file logo tai: ${pngPath}`);
    process.exit(1);
  }

  console.log('Dang chuyen doi logo.png thanh logo.ico...');
  const pngBuf = fs.readFileSync(pngPath);
  const icoBuf = convertPngToIco(pngBuf);
  fs.writeFileSync(icoPath, icoBuf);
  console.log(`Da tao thanh cong file icon tai: ${icoPath}`);

  // Auto-generate Windows Shortcut using PowerShell
  console.log('Dang tao Shortcut Windows voi icon logo...');
  const psCommand = `
    $WshShell = New-Object -ComObject WScript.Shell;
    $Shortcut = $WshShell.CreateShortcut('${shortcutPath}');
    $Shortcut.TargetPath = '${batPath}';
    $Shortcut.WorkingDirectory = '${path.dirname(batPath)}';
    $Shortcut.IconLocation = '${icoPath}';
    $Shortcut.Description = 'Khoi dong He thong Dat mon Tam Xua';
    $Shortcut.Save();
  `;

  execSync(`powershell -NoProfile -Command "${psCommand.replace(/\n/g, ' ')}"`);
  console.log(`Da tao thanh cong Shortcut tai: ${shortcutPath}`);

} catch (err) {
  console.error('Co loi xay ra:', err.message);
}
