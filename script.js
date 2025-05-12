const si = require('systeminformation');

async function getDiskSerials() {
  try {
    const disks = await si.diskLayout();
    const serials = disks.map(disk => ({
      device: disk.name,
      type: disk.type,
      serial: disk.serialNum || "Недоступно",
      size: (disk.size / 1024 ** 3).toFixed(2) + ' GB'
    }));
    return serials;
  } catch (error) {
    console.error('Ошибка при получении серийных номеров:', error);
    return null;
  }
}

// Пример использования
(async () => {
  const serials = await getDiskSerials();
  console.log('Серийные номера дисков:', serials);

  console.log(require('crypto').randomBytes(32).toString('hex'));
})();