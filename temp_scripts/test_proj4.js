const proj4 = require('proj4');

proj4.defs("EPSG:32717", "+proj=utm +zone=17 +south +datum=WGS84 +units=m +no_defs");

// Correct: [lng, lat]
const correct = proj4('EPSG:4326', 'EPSG:32717', [-79.4, -1.4]);
console.log("Correct:", correct);

// Wrong: [lat, lng]
const wrong = proj4('EPSG:4326', 'EPSG:32717', [-1.4, -79.4]);
console.log("Wrong:", wrong);
