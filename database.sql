CREATE DATABASE pc_inventory;

USE pc_inventory;

CREATE TABLE computers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pc_name VARCHAR(255),
  cpu VARCHAR(255),
  ram VARCHAR(50),
  os VARCHAR(255),
  disks JSON,  -- MySQL 5.7+ поддерживает JSON
  network JSON,
  timestamp DATETIME,
  place_install VARCHAR(255)
);