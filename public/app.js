let userContext = {};
let chatHistory = [];
let map, markers = [];
let activeFilter = 'all';
let savedLanguages = ['English'];
let activeLanguage = 'English';
let plannerEvents = [];
let map_api_key = '';

const RESOURCE_TYPES = {
  healthcare: { emoji: '🏥', color: '#1a73e8', query: 'clinic hospital medical center' },
  housing: { emoji: '🏠', color: '#7b1fa2', query: 'housing assistance shelter' },
  food: { emoji: '🍎', color: '#2e7d32', query: 'food bank food pantry' },
  work: { emoji: '💼', color: '#f57f17', query: 'employment center job center' },
  legal: { emoji: '⚖️', color: '#c62828', query: 'legal aid immigration lawyer' },
  school: { emoji: '🏫', color: '#00838f', query: 'public school enrollment' }
};

// INIT
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

  // Try to get real GPS location
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userPos = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        map.setCenter(userPos);

        new google.maps.Marker({
          map,
          position: userPos,
          title: 'You are here',
          icon: {
            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#1a73e8" stroke="white" stroke-width="3"/><circle cx="12" cy="12" r="4" fill="white"/></svg>`)}`,
            scaledSize: new google.maps.Size(24, 24)
          }
        });

        searchNearbyResources(userPos, activeFilter);
      },
      () => {
        // GPS denied — fall back to geocoded location
      }
    );
  }
};

// INTAKE
document.getElementById('start-btn').addEventListener('click', () => {
  const country = document.getElementById('country').value.trim();
  const location = document.getElementById('location').value.trim();
  const need = document.getElementById('need').value;

  if (!country || !location || !need) { alert('Please fill out all fields!'); return; }

  userContext = { country, location, need };
  document.getElementById('session-label').textContent = `${country} → ${location}`;
  document.getElementById('intake-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('hidden');

  init();
  geocodeLocation(location);
  addMessage('bot', `👋 Welcome to LandingPad! I'm here to help you navigate life in ${location}. You can type in any language. What's your first question?`);
  loadRecommendedPlaces(location, need);
});

// GEOCODE & CENTER MAP
function geocodeLocation(location) {
  if (!map_api_key) return;
  fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${map_api_key}`)
    .then(r => r.json())
    .then(data => {
      if (data.results[0]) {
        const coords = data.results[0].geometry.location;
        map.setCenter(coords);
        map.setZoom(13);
        searchNearbyResources(coords, activeFilter);
      }
    });
}

// SEARCH NEARBY RESOURCES
function searchNearbyResources(coords, filter) {
  markers.forEach(m => m.setMap(null));
  markers = [];

  const types = filter === 'all' ? Object.keys(RESOURCE_TYPES) : [filter];

  types.forEach(type => {
    const service = new google.maps.places.PlacesService(map);
    service.nearbySearch({
      location: coords,
      radius: 5000,
      keyword: RESOURCE_TYPES[type].query
    }, (results, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK) {
        results.slice(0, 3).forEach(place => addMarker(place, type));
        if (filter === activeFilter) updateSidebar(results.slice(0, 3), type);
      }
    });
  });
}

function addMarker(place, type) {
  const marker = new google.maps.Marker({
    map,
    position: place.geometry.location,
    title: place.name,
    icon: {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="${RESOURCE_TYPES[type].color}" stroke="white" stroke-width="2"/><text x="16" y="21" text-anchor="middle" font-size="14">${RESOURCE_TYPES[type].emoji}</text></svg>`)}`,
      scaledSize: new google.maps.Size(32, 32)
    }
  });

  marker.addListener('click', () => openPlaceModal(place, type));
  markers.push(marker);
}

async function openPlaceModal(place, type) {
  const modal = document.getElementById('place-modal');
  modal.classList.remove('hidden');

  document.getElementById('modal-name').textContent = place.name;
  document.getElementById('modal-rating').textContent = place.rating ? `⭐ ${place.rating} · ${RESOURCE_TYPES[type].emoji} ${type}` : `${RESOURCE_TYPES[type].emoji} ${type}`;
  document.getElementById('modal-address').textContent = `📍 ${place.vicinity || ''}`;
  document.getElementById('modal-phone').textContent = '';
  document.getElementById('modal-hours').textContent = '';
  document.getElementById('modal-photo').innerHTML = `<div class="modal-photo-placeholder">${RESOURCE_TYPES[type].emoji}</div>`;

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination_place_id=${place.place_id}`;
  document.getElementById('modal-directions').href = directionsUrl;

  document.getElementById('modal-chat-btn').onclick = () => {
    modal.classList.add('hidden');
    document.getElementById('user-input').value = `Tell me about ${place.name} and how it can help me`;
    sendMessage();
  };

  try {
    const res = await fetch(`/place-details?placeId=${place.place_id}`);
    const details = await res.json();

    if (details.photos && details.photos[0]) {
      const photoRef = details.photos[0].photo_reference;
      const photoUrl = `/place-photo?ref=${photoRef}`;
      document.getElementById('modal-photo').innerHTML = `<img src="${photoUrl}" alt="${place.name}" />`;
    }

    if (details.formatted_phone_number) {
      document.getElementById('modal-phone').textContent = `📞 ${details.formatted_phone_number}`;
    }

    if (details.opening_hours && details.opening_hours.weekday_text) {
      document.getElementById('modal-hours').textContent = details.opening_hours.weekday_text.slice(0, 3).join(' · ');
    }

    if (details.website) {
      const websiteBtn = document.getElementById('modal-website');
      websiteBtn.href = details.website;
      websiteBtn.classList.remove('hidden');
    }
  } catch (e) {
    console.log('Could not load place details');
  }
}

document.getElementById('close-modal-btn').addEventListener('click', () => {
  document.getElementById('place-modal').classList.add('hidden');
});

// SIDEBAR
function updateSidebar(places, type) {
  const list = document.getElementById('recommended-list');
  
  // Limit total sidebar items to 5 per category
  const existing = list.querySelectorAll('.place-item').length;
  if (existing >= 10) return;

  places.slice(0, 2).forEach(place => {
    const item = document.createElement('div');
    item.className = 'place-item';
    item.innerHTML = `
      <div class="place-icon" style="background:${RESOURCE_TYPES[type].color}22;">${RESOURCE_TYPES[type].emoji}</div>
      <div>
        <div class="place-name">${place.name}</div>
        <div class="place-dist">${place.vicinity ? place.vicinity.split(',')[0] : ''}</div>
      </div>`;
    item.addEventListener('click', () => {
      map.setCenter(place.geometry.location);
      map.setZoom(16);
      openPlaceModal(place, type);
    });
    list.appendChild(item);
  });
}
document.getElementById('sidebar-search').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const query = e.target.value.trim();
    if (!query || !map) return;

    const service = new google.maps.places.PlacesService(map);
    service.textSearch({
      query: `${query} ${userContext.location || 'Eugene Oregon'}`,
      location: map.getCenter(),
      radius: 10000
    }, (results, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && results[0]) {
        const place = results[0];
        map.setCenter(place.geometry.location);
        map.setZoom(16);

        const marker = new google.maps.Marker({
          map,
          position: place.geometry.location,
          title: place.name,
          animation: google.maps.Animation.DROP,
          icon: {
            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#FFD700" stroke="white" stroke-width="2"/><text x="18" y="23" text-anchor="middle" font-size="16">🔍</text></svg>`)}`,
            scaledSize: new google.maps.Size(36, 36)
          }
        });
        markers.push(marker);

        const list = document.getElementById('recommended-list');
        const item = document.createElement('div');
        item.className = 'place-item';
        item.innerHTML = `
          <div class="place-icon" style="background:#FFD70033;">🔍</div>
          <div>
            <div class="place-name">${place.name}</div>
            <div class="place-dist">${place.vicinity ? place.vicinity.split(',')[0] : ''}</div>
          </div>`;
        item.addEventListener('click', () => {
          map.setCenter(place.geometry.location);
          map.setZoom(16);
          openPlaceModal(place, 'healthcare');
        });
        list.prepend(item);

        e.target.value = '';
        openPlaceModal(place, 'healthcare');
      } else {
        alert('Place not found. Try a more specific name!');
      }
    });
  }
});
// FILTER PILLS
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

// LOAD AI RECOMMENDED PLACES FOR SIDEBAR
function loadRecommendedPlaces(location, need) {
  const type = need === 'healthcare' ? 'healthcare'
    : need === 'housing' ? 'housing'
    : need === 'school' ? 'school'
    : need === 'work' ? 'work'
    : need === 'legal' ? 'legal'
    : 'food';

  setTimeout(() => {
    if (map) {
      const center = map.getCenter();
      searchNearbyResources({ lat: center.lat(), lng: center.lng() }, type);
    }
  }, 2000);
}

// CHAT
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

function extractAndPinPlaces(text) {
  if (!map) return;

  // Just search for the whole response context on the map
  const placeMatch = text.match(/([A-Z][a-zA-Z\s]+(?:Clinic|Center|Bank|Library|School|Services|Aid|Office|Pantry|Village|Bird))/);
  
  if (placeMatch) {
    const placeName = placeMatch[1].trim();
    const service = new google.maps.places.PlacesService(map);
    service.findPlaceFromQuery({
      query: `${placeName} Eugene Oregon`,
      fields: ['name', 'geometry', 'place_id', 'vicinity']
    }, (results, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && results[0]) {
        dropAIPin(results[0], placeName);
      }
    });
  }
}

function dropAIPin(place, name) {
  // Gold star pin for AI recommendations
  const marker = new google.maps.Marker({
    map,
    position: place.geometry.location,
    title: name,
    animation: google.maps.Animation.DROP,
    icon: {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#FFD700" stroke="white" stroke-width="2"/><text x="18" y="23" text-anchor="middle" font-size="16">⭐</text></svg>`)}`,
      scaledSize: new google.maps.Size(36, 36)
    }
  });

  markers.push(marker);
  map.panTo(place.geometry.location);

  // Add to sidebar
  const list = document.getElementById('recommended-list');
  const item = document.createElement('div');
  item.className = 'place-item';
  item.innerHTML = `
    <div class="place-icon" style="background:#FFD70033;">⭐</div>
    <div>
      <div class="place-name">${name}</div>
      <div class="place-dist">AI recommended</div>
    </div>`;
  item.addEventListener('click', () => {
    map.setCenter(place.geometry.location);
    map.setZoom(16);
  });
  list.prepend(item);

  marker.addListener('click', () => openPlaceModal(place, 'healthcare'));
}

// LANGUAGE
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
    item.addEventListener('click', () => {
      activeLanguage = lang;
      document.getElementById('lang-btn').textContent = `🌐 ${lang.slice(0, 2).toUpperCase()} ▾`;
      renderLanguages();
    });
    list.appendChild(item);
  });
}

// VOICE INPUT
document.getElementById('mic-btn').addEventListener('click', () => {
  if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
    alert('Voice input not supported in this browser.');
    return;
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SR();
  recognition.lang = 'auto';
  recognition.onresult = e => {
    document.getElementById('user-input').value = e.results[0][0].transcript;
  };
  recognition.start();
});

// PLANNER
document.getElementById('add-event-btn').addEventListener('click', () => {
  const title = prompt('Appointment title?');
  const date = prompt('Date? (e.g. Jun 2, 10am)');
  if (title && date) {
    plannerEvents.push({ title, date });
    renderPlanner();
  }
});

function renderPlanner() {
  const container = document.getElementById('planner-events');
  container.innerHTML = '';
  plannerEvents.slice(0, 3).forEach(event => {
    const div = document.createElement('div');
    div.className = 'planner-event';
    div.innerHTML = `<span>${event.date}</span> — ${event.title}`;
    container.appendChild(div);
  });
}

// EMAIL DRAFT
document.getElementById('draft-email-btn').addEventListener('click', async () => {
  const prompt = document.getElementById('email-prompt').value.trim();
  if (!prompt) return;
  const draftEl = document.getElementById('email-draft');
  draftEl.classList.remove('hidden');
  draftEl.textContent = 'Drafting your email...';

  try {
    const res = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Write a professional email for this request: ${prompt}. Write it in the language implied by the request. Only return the email text, no explanation.`,
        history: [],
        userContext
      })
    });
    const data = await res.json();
    draftEl.textContent = data.reply || 'Could not generate email.';
  } catch {
    draftEl.textContent = 'Error generating email. Try again.';
  }
});

// NEW SESSION
document.getElementById('new-session-btn').addEventListener('click', () => {
  if (confirm('Start a new session? Current chat will be cleared.')) {
    chatHistory = [];
    document.getElementById('chat-messages').innerHTML = '';
    document.getElementById('recommended-list').innerHTML = '';
    document.getElementById('app-screen').classList.add('hidden');
    document.getElementById('intake-screen').classList.remove('hidden');
  }
});