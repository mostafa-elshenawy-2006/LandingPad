let userContext = {};
let chatHistory = [];
let map, markers = [];
let activeFilter = 'all';
let savedLanguages = ['English', 'Spanish', 'French', 'Arabic'];
let activeLanguage = 'English';
let plannerEvents = [];
let map_api_key = '';
let pinnedPlaces = [];
const aiRecommendedQueries = new Set();

const RESOURCE_TYPES = {
  healthcare: { emoji: '🏥', color: '#1a73e8', query: 'clinic hospital medical center' },
  housing: { emoji: '🏠', color: '#7b1fa2', query: 'housing assistance shelter' },
  food: { emoji: '🍎', color: '#2e7d32', query: 'food bank food pantry' },
  work: { emoji: '💼', color: '#f57f17', query: 'employment center job center' },
  legal: { emoji: '⚖️', color: '#c62828', query: 'legal aid immigration lawyer' },
  school: { emoji: '🏫', color: '#00838f', query: 'public school enrollment' }
};

const AI_PLACE_TYPE = { emoji: '⭐', color: '#FFD700', label: 'AI recommended' };

const UI_TRANSLATIONS = {
  English: {
    aiGuide: 'AI Guide',
    pinned: 'PINNED',
    aiRecommended: 'AI RECOMMENDED',
    recents: 'RECENTS',
    searchPlaces: 'Search places...',
    planner: 'Planner',
    addAppointment: 'Add appointment',
    email: 'Write email in your language',
    draft: 'Draft',
    findDoctor: 'Find a doctor',
    enrollKids: 'Enroll kids',
    legalHelp: 'Legal help',
    foodHelp: 'Food help'
  },
  Spanish: {
    aiGuide: 'Guía de IA',
    pinned: 'FIJADOS',
    aiRecommended: 'RECOMENDADOS POR IA',
    recents: 'RECIENTES',
    searchPlaces: 'Buscar lugares...',
    planner: 'Planificador',
    addAppointment: 'Agregar cita',
    email: 'Escribir correo en tu idioma',
    draft: 'Redactar',
    findDoctor: 'Buscar doctor',
    enrollKids: 'Inscribir niños',
    legalHelp: 'Ayuda legal',
    foodHelp: 'Ayuda con comida'
  },
  French: {
    aiGuide: 'Guide IA',
    pinned: 'ÉPINGLÉS',
    aiRecommended: 'RECOMMANDÉS PAR IA',
    recents: 'RÉCENTS',
    searchPlaces: 'Rechercher des lieux...',
    planner: 'Agenda',
    addAppointment: 'Ajouter un rendez-vous',
    email: 'Écrire un e-mail dans votre langue',
    draft: 'Rédiger',
    findDoctor: 'Trouver un médecin',
    enrollKids: 'Inscrire les enfants',
    legalHelp: 'Aide juridique',
    foodHelp: 'Aide alimentaire'
  },
  Arabic: {
    aiGuide: 'دليل الذكاء الاصطناعي',
    pinned: 'المثبتة',
    aiRecommended: 'موصى بها من الذكاء الاصطناعي',
    recents: 'الأخيرة',
    searchPlaces: 'ابحث عن أماكن...',
    planner: 'المخطط',
    addAppointment: 'إضافة موعد',
    email: 'اكتب بريدا بلغتك',
    draft: 'صياغة',
    findDoctor: 'ابحث عن طبيب',
    enrollKids: 'تسجيل الأطفال',
    legalHelp: 'مساعدة قانونية',
    foodHelp: 'مساعدة غذائية'
  }
};

const QUICK_ACTION_MESSAGES = {
  English: {
    findDoctor: 'How do I find a doctor near me?',
    enrollKids: 'How do I enroll my kids in school?',
    legalHelp: 'I need legal help with my immigration status',
    foodHelp: 'Where can I find food assistance near me?'
  },
  Spanish: {
    findDoctor: '¿Cómo encuentro un doctor cerca de mí?',
    enrollKids: '¿Cómo inscribo a mis hijos en la escuela?',
    legalHelp: 'Necesito ayuda legal con mi estatus migratorio',
    foodHelp: '¿Dónde puedo encontrar ayuda alimentaria cerca de mí?'
  },
  French: {
    findDoctor: 'Comment trouver un médecin près de moi ?',
    enrollKids: 'Comment inscrire mes enfants à l’école ?',
    legalHelp: 'J’ai besoin d’aide juridique pour mon statut d’immigration',
    foodHelp: 'Où puis-je trouver une aide alimentaire près de moi ?'
  },
  Arabic: {
    findDoctor: 'كيف أجد طبيبا بالقرب مني؟',
    enrollKids: 'كيف أسجل أطفالي في المدرسة؟',
    legalHelp: 'أحتاج إلى مساعدة قانونية بخصوص وضعي في الهجرة',
    foodHelp: 'أين أجد مساعدة غذائية بالقرب مني؟'
  }
};

function getResourceMeta(type) {
  return RESOURCE_TYPES[type] || AI_PLACE_TYPE;
}

function escapeHTML(value = '') {
  return value.replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function getPlacePosition(place) {
  if (!place || !place.geometry || !place.geometry.location) return null;
  const location = place.geometry.location;
  return {
    lat: typeof location.lat === 'function' ? location.lat() : location.lat,
    lng: typeof location.lng === 'function' ? location.lng() : location.lng
  };
}

function serializePlace(place) {
  const position = getPlacePosition(place);
  return {
    place_id: place.place_id || `${place.name}-${place.vicinity || place.formatted_address || ''}`,
    name: place.name,
    vicinity: place.vicinity || place.formatted_address || '',
    formatted_address: place.formatted_address || place.vicinity || '',
    rating: place.rating,
    geometry: position ? { location: position } : undefined
  };
}

function savePinnedPlaces() {
  localStorage.setItem('landingpad-pinned', JSON.stringify(pinnedPlaces));
}

function isPlacePinned(place) {
  if (!place) return false;
  const id = place.place_id || `${place.name}-${place.vicinity || place.formatted_address || ''}`;
  return pinnedPlaces.some(pin => pin.place && pin.place.place_id === id);
}

function renderPinnedPlaces() {
  const list = document.getElementById('pinned-list');
  if (!list) return;
  list.innerHTML = '';
  pinnedPlaces.forEach(({ place, type }) => {
    if (place && place.geometry && place.geometry.location) {
      addPlaceToSidebar(place, type, { listId: 'pinned-list' });
    }
  });
}

function pinPlace(place, type) {
  if (!place || isPlacePinned(place)) return false;
  const pinned = { place: serializePlace(place), type };
  pinnedPlaces.push(pinned);
  savePinnedPlaces();
  renderPinnedPlaces();
  return true;
}

function unpinPlace(place) {
  if (!place) return false;
  const id = place.place_id || `${place.name}-${place.vicinity || place.formatted_address || ''}`;
  const originalLength = pinnedPlaces.length;
  pinnedPlaces = pinnedPlaces.filter(pin => pin.place && pin.place.place_id !== id);
  if (pinnedPlaces.length === originalLength) return false;
  savePinnedPlaces();
  renderPinnedPlaces();
  return true;
}

function loadPinnedPlaces() {
  try {
    pinnedPlaces = JSON.parse(localStorage.getItem('landingpad-pinned') || '[]');
  } catch {
    pinnedPlaces = [];
  }
  renderPinnedPlaces();
}

function updateUILanguage(lang) {
  const translations = { ...UI_TRANSLATIONS.English, ...(UI_TRANSLATIONS[lang] || {}) };
  const quickMessages = QUICK_ACTION_MESSAGES[lang] || QUICK_ACTION_MESSAGES.English;

  document.documentElement.lang = lang === 'Arabic' ? 'ar' : lang.slice(0, 2).toLowerCase();
  document.documentElement.dir = lang === 'Arabic' ? 'rtl' : 'ltr';

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (translations[key]) el.textContent = translations[key];
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    if (translations[key]) el.placeholder = translations[key];
  });

  document.querySelectorAll('[data-msg-key]').forEach(el => {
    const key = el.dataset.msgKey;
    if (quickMessages[key]) el.dataset.msg = quickMessages[key];
  });
}

async function translateUILabels(lang) {
  const message = `Translate these UI labels to ${lang}: AI Guide, Pinned, AI Recommended, Recents, Search places, Planner, Add appointment, Write email in your language, Draft. Return ONLY a valid JSON object with exactly these keys: aiGuide, pinned, aiRecommended, recents, searchPlaces, planner, addAppointment, email, draft. No explanation, no markdown, just the JSON.`;
  const res = await fetch('/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history: [] })
  });
  const data = await res.json();
  const jsonText = (data.reply || '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  UI_TRANSLATIONS[lang] = JSON.parse(jsonText);
}

async function init() {
  const res = await fetch('/config');
  const config = await res.json();
  map_api_key = config.mapsApiKey;
  loadGoogleMaps();
}

function loadGoogleMaps() {
  const script = document.createElement('script');
  script.src = `https://maps.googleapis.com/maps/api/js?key=${map_api_key}&libraries=places&callback=initMap`;
  script.async = true;
  document.head.appendChild(script);
}

window.initMap = function () {
  map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 44.0521, lng: -123.0868 },
    zoom: 13,
    styles: [{ featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }]
  });

  if (userContext.location) {
    geocodeLocation(userContext.location);
  }

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userPos = { lat: position.coords.latitude, lng: position.coords.longitude };
        new google.maps.Marker({
          map, position: userPos, title: 'You are here',
          icon: {
            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#1a73e8" stroke="white" stroke-width="3"/><circle cx="12" cy="12" r="4" fill="white"/></svg>`)}`,
            scaledSize: new google.maps.Size(24, 24)
          }
        });
      },
      () => {}
    );
  }
};

document.getElementById('start-btn').addEventListener('click', () => {
  const country = document.getElementById('country').value.trim();
  const location = document.getElementById('location').value.trim();
  const need = document.getElementById('need').value;
  if (!country || !location || !need) { alert('Please fill out all fields!'); return; }
  userContext = { country, location, need, language: 'English' };
  document.getElementById('session-label').textContent = `${country} → ${location}`;
  document.getElementById('intake-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('hidden');
  loadPinnedPlaces();
  init();
  addMessage('bot', `👋 Welcome to LandingPad! I'm here to help you navigate life in ${location}. You can type in any language. What's your first question?`);
});

function geocodeLocation(location) {
  if (!map || !window.google || !google.maps) return;

  if (google.maps.places) {
    const service = new google.maps.places.PlacesService(map);
    service.textSearch({ query: location }, (results, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && results[0]) {
        centerMapOnTypedLocation(results[0].geometry.location);
        return;
      }

      console.log(`Could not resolve location with Places "${location}": ${status}`);
      geocodeLocationWithGeocoder(location);
    });
    return;
  }

  geocodeLocationWithGeocoder(location);
}

function geocodeLocationWithGeocoder(location) {
  const geocoder = new google.maps.Geocoder();
  geocoder.geocode({ address: location }, (results, status) => {
    if (status !== 'OK' || !results[0]) {
      console.log(`Could not geocode location "${location}": ${status}`);
      alert(`Could not find "${location}" on the map. Please try adding the state or country.`);
      return;
    }

    centerMapOnTypedLocation(results[0].geometry.location);
  });
}

function centerMapOnTypedLocation(coords) {
  map.setCenter(coords);
  map.setZoom(13);
  searchNearbyResources(coords, activeFilter);
}

function searchNearbyResources(coords, filter) {
  markers.forEach(m => m.setMap(null));
  markers = [];
  const types = filter === 'all' ? Object.keys(RESOURCE_TYPES) : [filter];
  types.forEach(type => {
    const service = new google.maps.places.PlacesService(map);
    service.nearbySearch({
      location: coords, radius: 5000, keyword: RESOURCE_TYPES[type].query
    }, (results, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK) {
        results.slice(0, 3).forEach(place => addMarker(place, type));
        if (filter === activeFilter) updateSidebar(results.slice(0, 3), type);
      }
    });
  });
}

function addMarker(place, type) {
  const meta = getResourceMeta(type);
  const marker = new google.maps.Marker({
    map, position: place.geometry.location, title: place.name,
    icon: {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="${meta.color}" stroke="white" stroke-width="2"/><text x="16" y="21" text-anchor="middle" font-size="14">${meta.emoji}</text></svg>`)}`,
      scaledSize: new google.maps.Size(32, 32)
    }
  });
  marker.addListener('click', () => focusPlace(place, type));
  markers.push(marker);
}

async function openPlaceModal(place, type) {
  const meta = getResourceMeta(type);
  const modal = document.getElementById('place-modal');
  modal.classList.remove('hidden');
  document.getElementById('modal-name').textContent = place.name;
  document.getElementById('modal-rating').textContent = place.rating ? `⭐ ${place.rating} · ${meta.emoji} ${meta.label || type}` : `${meta.emoji} ${meta.label || type}`;
  document.getElementById('modal-address').textContent = `📍 ${place.vicinity || place.formatted_address || ''}`;
  document.getElementById('modal-phone').textContent = '';
  document.getElementById('modal-hours').textContent = '';
  document.getElementById('modal-photo').innerHTML = `<div class="modal-photo-placeholder">${meta.emoji}</div>`;
  document.getElementById('modal-directions').href = place.place_id
    ? `https://www.google.com/maps/dir/?api=1&destination_place_id=${place.place_id}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${place.name} ${place.vicinity || place.formatted_address || ''}`)}`;
  const websiteBtn = document.getElementById('modal-website');
  websiteBtn.classList.add('hidden');
  const pinBtn = document.getElementById('modal-pin-btn');
  const updatePinButton = () => {
    pinBtn.textContent = isPlacePinned(place) ? '📌 Unpin this place' : '📌 Pin this place';
  };
  updatePinButton();
  pinBtn.onclick = () => {
    if (isPlacePinned(place)) {
      unpinPlace(place);
      pinBtn.textContent = 'Removed';
    } else {
      pinPlace(place, type);
      pinBtn.textContent = '✅ Pinned!';
    }
    setTimeout(() => {
      updatePinButton();
    }, 1600);
  };
  document.getElementById('modal-chat-btn').onclick = () => {
    modal.classList.add('hidden');
    document.getElementById('user-input').value = `Tell me about ${place.name} and how it can help me`;
    sendMessage();
  };
  if (!place.place_id) return;
  try {
    const res = await fetch(`/place-details?placeId=${place.place_id}`);
    const details = await res.json();
    if (details.photos && details.photos[0]) {
      document.getElementById('modal-photo').innerHTML = `<img src="/place-photo?ref=${details.photos[0].photo_reference}" alt="${place.name}" />`;
    }
    if (details.formatted_phone_number) {
      document.getElementById('modal-phone').textContent = `📞 ${details.formatted_phone_number}`;
    }
    if (details.opening_hours && details.opening_hours.weekday_text) {
      document.getElementById('modal-hours').textContent = details.opening_hours.weekday_text.slice(0, 3).join(' · ');
    }
    if (details.website) {
      websiteBtn.href = details.website;
      websiteBtn.classList.remove('hidden');
    }
  } catch (e) { console.log('Could not load place details'); }
}

document.getElementById('close-modal-btn').addEventListener('click', () => {
  document.getElementById('place-modal').classList.add('hidden');
});

function focusPlace(place, type) {
  if (!place || !place.geometry || !place.geometry.location) return;
  map.setCenter(place.geometry.location);
  map.setZoom(16);
  openPlaceModal(place, type);
}

function addPlaceToSidebar(place, type, options = {}) {
  const list = document.getElementById(options.listId || 'recommended-list');
  const item = document.createElement('div');
  const meta = getResourceMeta(type);
  const address = place.vicinity || place.formatted_address || '';
  item.className = 'place-item';
  item.innerHTML = `
    <div class="place-icon" style="background:${meta.color}22;">${meta.emoji}</div>
    <div>
      <div class="place-name">${escapeHTML(place.name)}</div>
      <div class="place-dist">${escapeHTML(address ? address.split(',')[0] : '')}</div>
    </div>`;
  item.addEventListener('click', () => focusPlace(place, type));
  if (options.prepend) list.prepend(item);
  else list.appendChild(item);
  return item;
}

function addGoldMarker(place, titleIcon = '⭐') {
  const marker = new google.maps.Marker({
    map,
    position: place.geometry.location,
    title: place.name,
    animation: google.maps.Animation.DROP,
    icon: {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 38 38"><circle cx="19" cy="19" r="17" fill="#FFD700" stroke="white" stroke-width="2"/><text x="19" y="25" text-anchor="middle" font-size="17">${titleIcon}</text></svg>`)}`,
      scaledSize: new google.maps.Size(38, 38)
    }
  });
  marker.addListener('click', () => focusPlace(place, 'ai'));
  markers.push(marker);
  setTimeout(() => marker.setAnimation(google.maps.Animation.BOUNCE), 450);
  setTimeout(() => marker.setAnimation(null), 1800);
  return marker;
}

function updateSidebar(places, type) {
  const list = document.getElementById('recommended-list');
  const existing = list.querySelectorAll('.place-item').length;
  if (existing >= 10) return;
  places.slice(0, 2).forEach(place => {
    addPlaceToSidebar(place, type);
  });
}

document.getElementById('sidebar-search').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const query = e.target.value.trim();
    if (!query || !map) return;
    const service = new google.maps.places.PlacesService(map);
    service.textSearch({
      query: `${query} ${userContext.location || 'Eugene Oregon'}`,
      location: map.getCenter(), radius: 10000
    }, (results, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && results[0]) {
        const place = results[0];
        addGoldMarker(place, '🔍');
        addPlaceToSidebar(place, 'ai', { prepend: true });
        e.target.value = '';
        focusPlace(place, 'ai');
      } else {
        alert('Place not found. Try a more specific name!');
      }
    });
  }
});

document.querySelectorAll('.pill').forEach(pill => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    activeFilter = pill.dataset.filter;
    document.getElementById('recommended-list').innerHTML = '';
    if (map) {
      const center = map.getCenter();
      searchNearbyResources({ lat: center.lat(), lng: center.lng() }, activeFilter);
    }
  });
});

document.getElementById('send-btn').addEventListener('click', sendMessage);
document.getElementById('user-input').addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(); });
document.querySelectorAll('.quick-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.getElementById('user-input').value = btn.dataset.msg;
    sendMessage();
  });
});

async function sendMessage() {
  const input = document.getElementById('user-input');
  const message = input.value.trim();
  if (!message) return;
  input.value = '';
  addMessage('user', message);
  const typing = addMessage('typing', 'LandingPad is thinking...');
  try {
    const res = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history: chatHistory, userContext })
    });
    const data = await res.json();
    typing.remove();
    const reply = data.reply || 'Sorry, something went wrong.';
    addMessage('bot', reply);
    chatHistory.push({ role: 'user', parts: [{ text: message }] });
    chatHistory.push({ role: 'model', parts: [{ text: reply }] });
    handleAIPlaceMentions(reply);
  } catch {
    typing.remove();
    addMessage('bot', 'Connection error. Please try again.');
  }
}

function addMessage(type, text) {
  const messages = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = `message ${type}`;
  div.textContent = text.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  return div;
}

function extractPlaceMentions(text) {
  const addressWords = '(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl|Parkway|Pkwy)';
  const regex = new RegExp(`([A-Z][A-Za-z0-9&'.-]*(?:\\s+(?:[A-Z][A-Za-z0-9&'.-]*|for|of|the|and|de|del|la|le)){0,7})\\s+(?:at|on)\\s+((?:\\d{1,6}\\s+)?(?:[A-Z0-9][A-Za-z0-9'.-]*\\s+){0,6}${addressWords})`, 'g');
  const mentions = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    const name = match[1].replace(/^(Try|Visit|Call|Contact|Go to|You can visit)\s+/i, '').trim();
    const address = match[2].trim();
    if (name && address) mentions.push({ name, address, query: `${name} ${address}` });
  }
  return mentions;
}

function searchAIRecommendedPlace(query) {
  const normalized = query.toLowerCase();
  if (aiRecommendedQueries.has(normalized)) return;
  aiRecommendedQueries.add(normalized);

  const service = new google.maps.places.PlacesService(map);
  service.textSearch({
    query: `${query} ${userContext.location || ''}`.trim(),
    location: map.getCenter(),
    radius: 15000
  }, (results, status) => {
    if (status !== google.maps.places.PlacesServiceStatus.OK || !results[0]) return;
    const place = results[0];
    addGoldMarker(place);
    addPlaceToSidebar(place, 'ai', { prepend: true });
  });
}

function handleAIPlaceMentions(reply) {
  if (!map || !window.google || !google.maps || !google.maps.places) return;
  const mentions = extractPlaceMentions(reply);
  if (mentions.length > 0) {
    mentions.slice(0, 2).forEach(({ query }) => searchAIRecommendedPlace(query));
    return;
  }

  const fallbackRegex = /\b([A-Z][A-Za-z&'.-]+(?:\s+(?:[A-Z][A-Za-z&'.-]+|for|of|the|and|de|del|la|le)){1,8}\s+(?:Clinic|Center|Bank|Library|School|Services|Aid|Office|Pantry|Village|Health|Community|Food))\b/;
  const fallbackMatch = reply.match(fallbackRegex);
  if (fallbackMatch && fallbackMatch[1]) {
    const query = fallbackMatch[1].replace(/^(Try|Visit|Call|Contact|Go to|You can visit)\s+/i, '').trim();
    if (query) searchAIRecommendedPlace(query);
  }
}

document.getElementById('lang-btn').addEventListener('click', () => {
  document.getElementById('lang-overlay').classList.remove('hidden');
  renderLanguages();
});
document.getElementById('close-lang-btn').addEventListener('click', () => {
  document.getElementById('lang-overlay').classList.add('hidden');
});
document.getElementById('add-lang-btn').addEventListener('click', () => {
  const val = document.getElementById('new-lang-input').value.trim();
  if (val && !savedLanguages.includes(val)) {
    savedLanguages.push(val);
    renderLanguages();
    document.getElementById('new-lang-input').value = '';
  }
});

function renderLanguages() {
  const list = document.getElementById('saved-languages');
  list.innerHTML = '';
  savedLanguages.forEach(lang => {
    const item = document.createElement('div');
    item.className = `lang-item ${lang === activeLanguage ? 'active' : ''}`;
    item.innerHTML = `<span>${lang}</span>${lang === activeLanguage ? '<span>✓ Active</span>' : ''}`;
    item.addEventListener('click', async () => {
      activeLanguage = lang;
      userContext.language = lang;
      document.getElementById('lang-btn').textContent = `🌐 ${lang.slice(0, 2).toUpperCase()} ▾`;
      if (UI_TRANSLATIONS[lang]) {
        updateUILanguage(lang);
      } else {
        try {
          await translateUILabels(lang);
          updateUILanguage(lang);
        } catch (error) {
          console.log('Could not translate UI labels', error);
          updateUILanguage('English');
        }
      }
      document.getElementById('lang-overlay').classList.add('hidden');
      renderLanguages();
    });
    list.appendChild(item);
  });
}

document.getElementById('mic-btn').addEventListener('click', () => {
  if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
    alert('Voice input not supported in this browser.'); return;
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SR();
  recognition.lang = 'auto';
  recognition.onresult = e => { document.getElementById('user-input').value = e.results[0][0].transcript; };
  recognition.start();
});

document.getElementById('add-event-btn').addEventListener('click', () => {
  const title = prompt('Appointment title?');
  const date = prompt('Date? (e.g. Jun 2, 10am)');
  if (title && date) { plannerEvents.push({ title, date }); renderPlanner(); }
});

function parsePlannerDate(dateText) {
  const now = new Date();
  const months = {
    jan: 0, january: 0,
    feb: 1, february: 1,
    mar: 2, march: 2,
    apr: 3, april: 3,
    may: 4,
    jun: 5, june: 5,
    jul: 6, july: 6,
    aug: 7, august: 7,
    sep: 8, sept: 8, september: 8,
    oct: 9, october: 9,
    nov: 10, november: 10,
    dec: 11, december: 11
  };
  const match = dateText.match(/\b([a-z]+)\s+(\d{1,2})(?:,?\s+(\d{4}))?(?:,?\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?/i);
  let start;

  if (match && months[match[1].toLowerCase()] !== undefined) {
    const year = match[3] ? Number(match[3]) : now.getFullYear();
    let hour = match[4] ? Number(match[4]) : 9;
    const minute = match[5] ? Number(match[5]) : 0;
    const meridiem = match[6] ? match[6].toLowerCase() : '';

    if (meridiem === 'am' && hour === 12) hour = 0;
    if (meridiem === 'pm' && hour < 12) hour += 12;

    start = new Date(year, months[match[1].toLowerCase()], Number(match[2]), hour, minute, 0);
  } else {
    const parsed = Date.parse(dateText);
    start = Number.isNaN(parsed) ? new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0) : new Date(parsed);
  }

  if (start < now && !(match && match[3])) {
    start.setFullYear(start.getFullYear() + 1);
  }

  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return { start, end };
}

function formatCalendarDate(date) {
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
}

function openGoogleCalendarEvent(event) {
  const { start, end } = parsePlannerDate(event.date);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${formatCalendarDate(start)}/${formatCalendarDate(end)}`,
    details: 'Added from LandingPad'
  });
  window.open(`https://calendar.google.com/calendar/render?${params.toString()}`, '_blank', 'noopener');
}

function renderPlanner() {
  const container = document.getElementById('planner-events');
  container.innerHTML = '';
  plannerEvents.slice(0, 3).forEach(event => {
    const div = document.createElement('div');
    div.className = 'planner-event';
    const text = document.createElement('div');
    text.className = 'planner-event-text';
    text.innerHTML = `<span>${escapeHTML(event.date)}</span> — ${escapeHTML(event.title)}`;

    const calendarBtn = document.createElement('button');
    calendarBtn.className = 'planner-calendar-btn';
    calendarBtn.type = 'button';
    calendarBtn.title = 'Save to Google Calendar';
    calendarBtn.textContent = '📅';
    calendarBtn.addEventListener('click', () => openGoogleCalendarEvent(event));

    div.appendChild(text);
    div.appendChild(calendarBtn);
    container.appendChild(div);
  });
}

document.getElementById('draft-email-btn').addEventListener('click', async () => {
  const prompt = document.getElementById('email-prompt').value.trim();
  if (!prompt) return;
  const draftEl = document.getElementById('email-draft');
  const copyBtn = document.getElementById('copy-email-btn');
  draftEl.classList.remove('hidden');
  copyBtn.classList.add('hidden');
  draftEl.textContent = 'Drafting your email...';
  try {
    const res = await fetch('/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, language: activeLanguage })
    });
    const data = await res.json();
    draftEl.innerHTML = (data.reply || 'Could not generate email.')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
    copyBtn.classList.remove('hidden');
  } catch {
    draftEl.textContent = 'Error generating email. Try again.';
  }
});

document.getElementById('copy-email-btn').addEventListener('click', () => {
  const text = document.getElementById('email-draft').textContent;
  navigator.clipboard.writeText(text).then(() => {
    document.getElementById('copy-email-btn').textContent = '✅ Copied!';
    setTimeout(() => { document.getElementById('copy-email-btn').textContent = '📋 Copy email'; }, 2000);
  });
});

document.getElementById('new-session-btn').addEventListener('click', () => {
  if (confirm('Start a new session? Current chat will be cleared.')) {
    chatHistory = [];
    document.getElementById('chat-messages').innerHTML = '';
    document.getElementById('recommended-list').innerHTML = '';
    document.getElementById('app-screen').classList.add('hidden');
    document.getElementById('intake-screen').classList.remove('hidden');
  }
});

const settingsBtn = document.getElementById('settings-btn');
const settingsMenu = document.getElementById('settings-menu');

settingsBtn.addEventListener('click', (event) => {
  event.stopPropagation();
  const isHidden = settingsMenu.classList.toggle('hidden');
  settingsBtn.setAttribute('aria-expanded', String(!isHidden));
});

settingsMenu.addEventListener('click', event => event.stopPropagation());

document.addEventListener('click', () => {
  settingsMenu.classList.add('hidden');
  settingsBtn.setAttribute('aria-expanded', 'false');
});

document.getElementById('text-size-setting').addEventListener('change', (event) => {
  document.body.setAttribute('data-text-size', event.target.value);
});

document.getElementById('theme-setting').addEventListener('change', (event) => {
  document.body.setAttribute('data-theme', event.target.value);
});

document.getElementById('settings-language-btn').addEventListener('click', () => {
  settingsMenu.classList.add('hidden');
  settingsBtn.setAttribute('aria-expanded', 'false');
  document.getElementById('lang-overlay').classList.remove('hidden');
  renderLanguages();
});

document.getElementById('settings-clear-chat-btn').addEventListener('click', () => {
  chatHistory = [];
  document.getElementById('chat-messages').innerHTML = '';
  settingsMenu.classList.add('hidden');
  settingsBtn.setAttribute('aria-expanded', 'false');
});

document.getElementById('settings-about-btn').addEventListener('click', () => {
  settingsMenu.classList.add('hidden');
  settingsBtn.setAttribute('aria-expanded', 'false');
  alert('LandingPad is an AI guide that helps immigrants and newcomers find nearby services, write messages, and plan next steps.');
});

updateUILanguage(activeLanguage);
