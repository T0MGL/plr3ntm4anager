// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MapContainer, TileLayer, Marker, GeoJSON, useMapEvents } from 'react-leaflet';
import { IoLocationOutline } from 'react-icons/io5';
import axios from 'axios';
import L from 'leaflet';
import toast from 'react-hot-toast';
import 'leaflet/dist/leaflet.css';
import { StorageService } from '../../../../services/storageService';

// Custom Black Marker Icon
const blackPinSvg = `
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2ZM12 11.5C10.62 11.5 9.5 10.38 9.5 9C9.5 7.62 10.62 6.5 12 6.5C13.38 6.5 14.5 7.62 14.5 9C14.5 10.38 13.38 11.5 12 11.5Z" fill="black"/>
  </svg>
`;

const mapBounds = [
  [-90, -180],
  [90, 180]
];

const customIcon = L.divIcon({
  html: blackPinSvg,
  className: 'custom-pin-icon',
  iconSize: [48, 48],
  iconAnchor: [24, 48],
});

const Step1LocationConfirm = ({ onValidityChange, onDataChange }) => {
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [countriesGeoJSON, setCountriesGeoJSON] = useState(null);

  // Fetch Countries GeoJSON for stylistic look
  useEffect(() => {
    axios.get('https://raw.githubusercontent.com/martynafford/natural-earth-geojson/master/110m/cultural/ne_110m_admin_0_countries.json')
      .then(res => setCountriesGeoJSON(res.data))
      .catch(err => console.error('Failed to load countries GeoJSON', err));
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        const saved = await StorageService.getItem('step 1 host');
        if (saved && saved.location) {
          setLocation(saved.location);
        }
      } catch (err) {
        console.error('Failed to load location for confirmation:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
    onValidityChange?.(true);
  }, [onValidityChange]);

  const updateAddressFromCoords = async (lat, lon) => {
    try {
      const res = await axios.get('https://nominatim.openstreetmap.org/reverse', {
        params: {
          lat,
          lon,
          format: 'json',
          addressdetails: 1
        },
        headers: {
          'Accept-Language': 'en'
        }
      });

      const data = res.data;
      if (!data || !data.address) return;

      // Check if it's a city-like entity
      const isCityType = ['city', 'town', 'village', 'hamlet', 'suburb', 'neighbourhood'].some(type => data.address[type] || data.type === type);

      if (!isCityType) {
        toast.error("you can only select city name to update address", {
          style: {
            background: '#222222',
            color: '#fff',
            fontSize: '14px',
            borderRadius: '10px'
          }
        });
        return;
      }

      const newCity = data.address.city || data.address.town || data.address.village || data.address.suburb || '';
      const newState = data.address.state || data.address.province || '';
      const newCountry = data.address.country || '';
      const newZip = data.address.postcode || '';
      const newFull = `${newCity}, ${newState}, ${newCountry}, ${newZip}`;

      const updatedLocation = {
        ...location,
        lat: lat.toString(),
        lon: lon.toString(),
        city: newCity,
        state: newState,
        country: newCountry,
        zipCode: newZip,
        postcode: newZip,
        fullAddress: newFull
      };

      setLocation(updatedLocation);
      
      // Notify parent flow
      onDataChange?.({ 
        'step 1 host': { 
          location: updatedLocation 
        } 
      });

      // Update SQLite
      const existing = await StorageService.getItem('step 1 host') || {};
      await StorageService.setItem('step 1 host', {
        ...existing,
        location: updatedLocation
      });

      toast.success(`Updated to ${newCity}`, {
        icon: '📍',
        style: {
          background: '#A1642E',
          color: '#fff',
          borderRadius: '10px'
        }
      });

    } catch (err) {
      console.error('Reverse geocode failed', err);
      toast.error("Failed to update location");
    }
  };

  const MapClickHandler = () => {
    useMapEvents({
      click: (e) => {
        updateAddressFromCoords(e.latlng.lat, e.latlng.lng);
      },
    });
    return null;
  };

  if (loading) {
    return (
      <div className="w-full flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!location) {
    return (
      <div className="text-left py-20 font-medium text-gray-500">
        No location data found. Please go back and select an address.
      </div>
    );
  }

  const position = [parseFloat(location.lat || 20), parseFloat(location.lon || 10)];

  // Stylistic coloring for countries like the image
  const countryStyle = (feature) => {
    const colors = ['#A3D9A5', '#F9E79F', '#F5CBA7', '#F1948A', '#AED6F1', '#D2B4DE', '#A2D9CE'];
    const name = feature.properties.NAME || "";
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const color = colors[Math.abs(hash) % colors.length];

    return {
      fillColor: color,
      weight: 0.5,
      opacity: 1,
      color: '#ffffff',
      fillOpacity: 0.8
    };
  };

  return (
    <div className="w-full h-full flex flex-col items-center md:px-4">
      <div className="w-full max-w-4xl text-left mb-8">
        <h1 className="text-2xl md:text-2xl font-semibold text-[#222222]">
          Confirma la ubicacion de la unidad
        </h1>
        <p className="text-[#6A6A6A] text-[15px] mt-2 font-normal">
          La direccion exacta solo se comparte con el huesped despues de confirmar la reserva.
        </p>
      </div>

      <div className="relative w-full max-w-4xl h-[420px] md:h-[520px] rounded-3xl overflow-hidden shadow-lg border border-gray-100">
        {/* Map Container */}
        <div className="absolute inset-0 z-0 bg-[#AAD3DF]">
          <MapContainer 
            center={position} 
            zoom={1.8} 
            minZoom={1.5}
            maxBounds={mapBounds}
            maxBoundsViscosity={1.0}
            worldCopyJump={false}
            zoomSnap={0.1}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
            dragging={true}
            touchZoom={true}
            doubleClickZoom={true}
            scrollWheelZoom={true}
            attributionControl={false}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png"
              noWrap={true}
              bounds={mapBounds}
            />
            {countriesGeoJSON && (
              <GeoJSON 
                data={countriesGeoJSON} 
                style={countryStyle}
              />
            )}
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png"
              noWrap={true}
              bounds={mapBounds}
            />
            <MapClickHandler />
            <Marker position={position} icon={customIcon} />
          </MapContainer>
        </div>

        {/* Floating Address Bar */}
        <div className="absolute top-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-6">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center bg-white rounded-full shadow-xl border border-gray-100 px-6 py-4"
          >
            <IoLocationOutline className="text-xl text-[#222222] mr-3 shrink-0" />
            <span className="text-[15px] font-medium text-[#222222] truncate">
              {location.fullAddress}
            </span>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Step1LocationConfirm;