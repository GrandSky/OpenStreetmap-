const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const request = require('request');
const app = express();
const port = 3000;
const mapnik = require('mapnik');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
//Change based on your own postgresql
const client = new Pool({
  user: 'renderer',
  host: '209.151.151.241', 
  database: 'gis',
  password: 'renderer',
  port: 5432, // Your PostgreSQL port
});
// Middleware for parsing JSON request bodies
app.use(bodyParser.json());
//app.use(express.static(path.join(__dirname, 'public')));
// PostgreSQL database connection configuration
app.get('/', (req, res) => {
        res.sendFile('index.html');
});
/*app.post('/api/address', (req, res) => {
  // Extract latitude and longitude from request body
  const { lat, lon } = req.body;

  // Construct the SQL query to retrieve the address based on the provided latitude and longitude
  const sqlQuery = `
    SELECT address_column_1, address_column_2, ... -- Specify the columns you want to retrieve
    FROM your_table_name
    WHERE latitude_column = $1 AND longitude_column = $2;
  `;

  // Execute the SQL query with the provided latitude and longitude values
  client.query(sqlQuery, [lat, lon], (err, result) => {
    if (err) {
      console.error('Error executing PostgreSQL query:', err);
      // Send an error response
      return res.status(500).json({ error: 'Failed to retrieve address from database' });
    }

    // Extract the address data from the query result
    const addressData = result.rows[0]; // Assuming you're expecting only one row of address data

    // Send the address data as the response
    res.json(addressData);
  });
});*/
// Map Tiles Endpoint
/*app.get('/tiles/:layer/:v/:h.png', async (req, res) => {
  const { layer, v, h } = req.params;
  console.log("req:layer,v,h", layer,v,h);
  const url = `http://194.113.74.114:8080/tile/${layer}/${v}/${h}.png`;
  request({
    url: url,
    encoding: null
  },
  (err, resp, buffer) => {
    if (!err && resp.statusCode === 200){
      res.set("Content-Type", "image/png");
      res.send(resp.body);
    }
  });
  // Fetch the requested tile from the database or file storage
  // and send it as a response (e.g., using res.sendFile)
});
*/
// Search Endpoint
app.post('/api/search', async (req, res) => {
    const { bbox, onlyInBox, searchTerm } = req.body;
    console.log(searchTerm, onlyInBox, bbox);
    try {
      let allResults = [];
  /*    let tables = [];
      // Execute a database query to search for objects within the given bounding box
      // and matching the search term
      for (const tableRecord of tables) { // Replace 'tables' with the array of tables
        // Construct the search query dynamically for the current table
        const query = `SELECT ST_X(geometry) AS longitude, ST_Y(geometry) AS latitude FROM ${tableRecord.tableName} WHERE name ILIKE ${searchTerm} LIMIT 10`;
        // Execute the query with the search term as a parameter
        const result = await client.query(query, [`%${searchTerm}%`]);

        // Add results to the array
        allResults = [...allResults, ...result.rows];
      }
      console.log(allResults);
      const result = await client.query();*/

      const query = `
SELECT
    array_to_json(array_agg(
      json_build_object(
        'name', name,
        'coordinates', json_build_object(
          'lat', lat,
          'lon', lon
        ),
        'bbox', json_build_object(
          'minLat', minLat,
          'minLon', minLon,
          'maxLat', maxLat,
          'maxLon', maxLon
        )
      )
    )) AS results
FROM (
    -- Query for planet_osm_polygon
    SELECT
      name,
      ST_Y(ST_Centroid(ST_Transform(way::geometry, 4326))) AS lat,
      ST_X(ST_Centroid(ST_Transform(way::geometry, 4326))) AS lon,
      ST_YMin(bbox) AS minLat,
      ST_XMin(bbox) AS minLon,
      ST_YMax(bbox) AS maxLat,
      ST_XMax(bbox) AS maxLon
    FROM (
      SELECT
        ST_Extent(ST_Transform(way::geometry, 4326)) AS bbox,
        name,
        way
      FROM planet_osm_polygon
      WHERE name ILIKE $1
      AND way IS NOT NULL
      GROUP BY name, way
    ) AS subquery1

    UNION ALL

    -- Query for planet_osm_point
    SELECT
      name,
      ST_Y(ST_Transform(way::geometry, 4326)) AS lat,
      ST_X(ST_Transform(way::geometry, 4326)) AS lon,
      ST_YMin(bbox) AS minLat,
      ST_XMin(bbox) AS minLon,
      ST_YMax(bbox) AS maxLat,
      ST_XMax(bbox) AS maxLon
    FROM (
      SELECT
        ST_Extent(ST_Transform(ST_SetSRID(way, 3857), 4326)) AS bbox,
        name,
        way
      FROM planet_osm_point
      WHERE name ILIKE $1
      AND way IS NOT NULL
      GROUP BY name, way
      ) AS subquery1

      UNION ALL

      -- Query for planet_osm_point
      SELECT
        name,
        ST_Y(ST_Transform(way::geometry, 4326)) AS lat,
        ST_X(ST_Transform(way::geometry, 4326)) AS lon,
        ST_YMin(bbox) AS minLat,
        ST_XMin(bbox) AS minLon,
        ST_YMax(bbox) AS maxLat,
        ST_XMax(bbox) AS maxLon
      FROM (
        SELECT
          ST_Extent(ST_Transform(ST_SetSRID(way, 3857), 4326)) AS bbox,
          name,
          way
        FROM planet_osm_point
        WHERE name ILIKE $1
        AND way IS NOT NULL
        GROUP BY name, way
      ) AS subquery2

      UNION ALL

      -- Query for planet_osm_line
      SELECT
        name,
        ST_Y(ST_Centroid(ST_Transform(way::geometry, 4326))) AS lat,
        ST_X(ST_Centroid(ST_Transform(way::geometry, 4326))) AS lon,
        ST_YMin(bbox) AS minLat,
        ST_XMin(bbox) AS minLon,
        ST_YMax(bbox) AS maxLat,
        ST_XMax(bbox) AS maxLon
      FROM (
        SELECT
          ST_Extent(ST_Transform(way::geometry, 4326)) AS bbox,
          name,
          way
        FROM planet_osm_line
        WHERE name ILIKE $1
        AND way IS NOT NULL
        GROUP BY name, way
      ) AS subquery3
  ) AS final_query;

  `;
      // Execute the query with the search term as a parameter
      const { rows } = await client.query(query, [`%${searchTerm}%`]);


      // Extract the results from the query response
  console.log(rows);

  const searchResults = rows.length > 0 ? rows[0].results : [];
  if (!searchResults || searchResults.length === 0) {
          // No results found, return an empty array
          res.status(200).json([]);
          return;
      }

           let filteredResults = searchResults;
      if (onlyInBox && bbox) {
        filteredResults = searchResults.filter(point => {
          const { lat, lon } = point.coordinates;
          return (
            lat >= bbox.minLat &&
            lat <= bbox.maxLat &&
            lon >= bbox.minLon &&
            lon <= bbox.maxLon
          );
        });
      }

       const adjustedResults = filteredResults.map(result => {
        if (onlyInBox) {
          // Calculate center of visible portion within bbox
      const minLat = Math.max(result.bbox.minLat, bbox.minLat);
      const maxLat = Math.min(result.bbox.maxLat, bbox.maxLat);
      const minLon = Math.max(result.bbox.minLon, bbox.minLon);
      const maxLon = Math.min(result.bbox.maxLon, bbox.maxLon);

      const lat = (maxLat + minLat) / 2;
      const lon = (maxLon + minLon) / 2;
          return { ...result, lat, lon };
        } else {
          // Keep original coordinates
          return result;
        }
      });
    // Log the adjusted results
    console.log("Adjusted search results:", adjustedResults);
const jsonResponse = JSON.stringify(adjustedResults);

    // Send the adjusted search results as a response
    res.status(200).json(adjustedResults);    // Log the results
    //console.log("Search results:", searchResults);

    // Send the search results as a response

    //res.status(200).json(searchResults);
 } catch (error) {
    console.error('Error executing search query:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/address', async (req, res) => {
  // Extract latitude and longitude from request body
  const { lat, lon } = req.body;
console.log(lat,lon)
  json = {
  "number": '',
  "street": '',
  "city": '',
  "state": '',
  "country": 'USA'
}

const query = `SELECT
    "addr:housenumber" AS housenumber,
    tags->'addr:street' AS street,
    tags->'addr:city' AS city,
    tags->'addr:state' AS state
FROM
    planet_osm_polygon
WHERE
    ST_Contains(
        ST_Transform(way, 4326),
        ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)

    );`

const { rows } = await client.query(query);


  rows.forEach(row => {
        if(row.housenumber) {


    json = {
  "number": row.housenumber,
  "street": row.street,
  "city": row.city,
  "state": row.state,
  "country": 'USA'
}
}
});
  console.log(json)
  // Close the connection to the PostgreSQL database
res.json(json)
  // Make the HTTP request to the geocoding API
/*  fetch(apiUrl)
    .then(response => {
      // Check if the response is successful
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      // Parse the JSON response
      return response.json();
    })
    .then(data => {
      // Extract address components from the response
      const { address } = data;
console.log(address)
      const { house_number, road,town, hamlet,village, city, state, country } = address;
      const cityName = city || town ||village|| hamlet || '';
      // Construct the address object in the desired format
      const formattedAddress = {
        number: house_number || '',
        street: road || '',
        city: cityName || '',
        state: state || '',
        country: country || ''
      };

      // Send the formatted address as the response
      console.log("ADDRESS")
      console.log(formattedAddress)
      res.json(formattedAddress);
    })
    .catch(error => {
      // Handle any errors that occurred during the fetch
      console.error('Error:', error);
      // Send an error response
      res.status(500).json({ error: 'Failed to retrieve address' });
    });*/
});


app.post('/convert', (req, res) => {
  const { lat, long, zoom } = req.body;

  // Calculate tile indices
  const x_tile = Math.floor((long + 180) / 360 * Math.pow(2, zoom));
  const y_tile = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));

  // Send the response
  res.json({ x_tile, y_tile });
});

// Function to convert latitude and longitude to tile indices
function convertLatLongToTile(lat, long, zoom) {
  const tileSize = 256;
  const numTiles = 1 << zoom;
  const circumference = 256 * numTiles;
  const x_tile = Math.floor((long + 180) / 360 * numTiles);
  const y_tile = Math.floor(
    (1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2 * numTiles
  );
  return { x_tile, y_tile };
}

app.get('/turn/:TL/:BR.png', async (req, res) => {
  try {
    // Extract TL (top-left) and BR (bottom-right) coordinates from request params
    const { TL, BR } = req.params;
console.log(TL,BR)
    // Calculate the average of TL and BR coordinates to determine the center of the turn
    const [avgLat, avgLon] = calculateCenterCoordinates(TL, BR);
console.log(avgLat,avgLon)
    // Calculate the zoom level based on the distance between TL and BR coordinates
    const zoomLevel = calculateZoomLevel(TL, BR);
console.log(zoomLevel)
  const x_tile = Math.floor((avgLon + 180) / 360 * Math.pow(2, zoomLevel));
  const y_tile = Math.floor((1 - Math.log(Math.tan(avgLat * Math.PI / 180) + 1 / Math.cos(avgLat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoomLevel));
console.log(x_tile,y_tile);
    // Use the center coordinates and zoom level to get the map tile
//    const mapTile = await getMapTile(avgLat, avgLon, zoomLevel);
//console.log(mapTile)
    // Return the PNG image
   // res.set('Content-Type', 'image/png');
    res.redirect(`http://209.94.59.28/tiles/${zoomLevel}/${x_tile}/${y_tile}.png`);
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Function to calculate the center coordinates of the turn
function calculateCenterCoordinates(TL, BR) {
  // Calculate the average of TL and BR coordinates
  // For demonstration purposes, let's assume TL and BR are strings in the format "lat,lon"
  const [TLLat, TLLon] = TL.split(',').map(parseFloat);
  const [BRLat, BRLon] = BR.split(',').map(parseFloat);
  const avgLat = (TLLat + BRLat) / 2;
  const avgLon = (TLLon + BRLon) / 2;
  return [avgLat, avgLon];
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180; // Convert latitude 1 to radians
    const φ2 = (lat2 * Math.PI) / 180; // Convert latitude 2 to radians
    const Δφ = ((lat2 - lat1) * Math.PI) / 180; // Difference in latitudes in radians
    const Δλ = ((lon2 - lon1) * Math.PI) / 180; // Difference in longitudes in radians

    // Haversine formula for distance calculation
    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in meters
    return d;
}
function calculateArea(TL, BR) {
    const [TLLat, TLLon] = TL.split(',').map(parseFloat);
    const [BRLat, BRLon] = BR.split(',').map(parseFloat);

    const horizontalDistance = calculateDistance(TLLat, TLLon, TLLat, BRLon);
    const verticalDistance = calculateDistance(TLLat, TLLon, BRLat, TLLon);

    // Convert distances to meters
    const horizontalDistanceMeters = horizontalDistance * 111319.9; // Approximate distance in meters per degree longitude at the equator
    const verticalDistanceMeters = verticalDistance * 111132.9; // Approximate distance in meters per degree latitude

    // Calculate area in square meters
    const area = horizontalDistanceMeters * verticalDistanceMeters;
    return area;
}

function calculateZoomLevel(TL, BR) {
const [TLLat, TLLon] = TL.split(',').map(parseFloat);
  const [BRLat, BRLon] = BR.split(',').map(parseFloat);

//const distance = calculateDistance(TLLat, TLLon, BRLat, BRLon);
    // Assuming a threshold distance for fitting within the map view
  const horizontalDistance = calculateDistance(TLLat, TLLon, TLLat, BRLon);
    const verticalDistance = calculateDistance(TLLat, TLLon, BRLat, TLLon);

    // Choose the maximum distance
    const distance = Math.max(horizontalDistance, verticalDistance);

    const thresholdArea = 10000; // Adjust this threshold as needed (in square meters)


    // Zoom levels based on tile size (256x256 pixels per tile)
    const maxZoomLevel = 19; // Maximum zoom level
    const tileSize = 256; // Tile size in pixels

    // Calculate zoom level based on distance and threshold
    let zoomLevel = maxZoomLevel


 while (zoomLevel > 0) {
        // Calculate the number of tiles per unit of distance
        const tilesPerDistance = (1 << zoomLevel) * tileSize / distance;
        // Calculate the number of tiles required to cover the area

        // If either condition is met, break the loop
        if (tilesPerDistance <= thresholdArea) {
            break;
        }
        zoomLevel--;
    }
    return zoomLevel;

}
// Function to get the map tile from the tile generator service
async function getMapTile(lat, lon, zoom) {
  // Use the provided tile generator service to fetch the map tile
  const tileUrl = `http://localhost:8080/tile/${lat}/${lon}/${zoom}.png`;
  const response = await axios.get(tileUrl, { responseType: 'arraybuffer' });
  return response.data;
}
// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
