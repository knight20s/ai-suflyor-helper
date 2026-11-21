const fs = require('fs');
const path = require('path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;
  const ResEdit = await import('resedit');
  const info = context.packager.appInfo;
  const exe = path.join(context.appOutDir, info.productFilename + '.exe');
  const pe = ResEdit.NtExecutable.from(fs.readFileSync(exe), { ignoreCert: true });
  const res = ResEdit.NtExecutableResource.from(pe);
  const ico = ResEdit.Data.IconFile.from(fs.readFileSync(path.join(context.packager.projectDir, 'assets', 'icon.ico')));
  const icons = ico.icons.map((i) => i.data);
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
  if (!groups.length) throw new Error('в exe нет иконок для замены');
  for (const g of groups) ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, g.id, g.lang, icons);
  const parts = String(info.version).split('.').map((n) => parseInt(n, 10) || 0);
  while (parts.length < 4) parts.push(0);
  for (const vi of ResEdit.Resource.VersionInfo.fromEntries(res.entries)) {
    for (const lang of vi.getAllLanguagesForStringValues()) {
      vi.setStringValues(lang, {
        ProductName: info.productName,
        FileDescription: info.productName,
        CompanyName: info.productName,
        InternalName: info.productFilename,
        OriginalFilename: info.productFilename + '.exe',
        LegalCopyright: '',
        FileVersion: parts.join('.'),
        ProductVersion: parts.join('.')
      });
    }
    vi.setFileVersion(parts[0], parts[1], parts[2], parts[3]);
    vi.setProductVersion(parts[0], parts[1], parts[2], parts[3]);
    vi.outputToResourceEntries(res.entries);
  }
  res.outputResource(pe);
  fs.writeFileSync(exe, Buffer.from(pe.generate()));
};
