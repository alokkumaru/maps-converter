# Google Maps → Apple Maps Converter

Convert any Google Maps link into an Apple Maps link — locations and multi-stop directions.

## Features

- Single locations (named places, coordinates, search results)
- Directions between two points
- Multi-stop directions (3+ waypoints) with individual leg links
- Shortened links (`maps.app.goo.gl`) resolved automatically
- Coordinates-based matching — same exact spot, no Apple Developer account required
- API keys stay server-side; nothing secret is exposed to the browser

## How it works

1. User pastes a Google Maps URL
2. The server resolves shortened links, then parses the URL structure
3. Google Places API / Geocoding API resolves each location to a canonical name, address, and coordinates
4. An Apple Maps URL is constructed using those coordinates + name (`?ll=lat,lng&q=Name`)
5. For directions, origin→destination links are built plus individual leg links for multi-stop routes

## Setup

### 1. Clone and install

```bash
git clone https://github.com/your-username/maps-converter
cd maps-converter
npm install
```

### 2. Get a Google Maps API key

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project (e.g. `maps-converter`)
3. Enable these two APIs:
   - **Places API**
   - **Geocoding API**
4. Go to **Credentials → Create API Key**
5. Under **API restrictions**, restrict the key to _Places API_ and _Geocoding API_ only
6. Copy the key

### 3. Configure environment

```bash
cp .env.local.example .env.local
# then edit .env.local and paste your key
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy to Vercel

```bash
npm i -g vercel
vercel
```

Add `GOOGLE_MAPS_API_KEY` in the Vercel dashboard under **Project → Settings → Environment Variables**.

## Project structure

```
app/
  page.tsx              # Client-side UI
  api/convert/route.ts  # POST /api/convert (server-side, API key never exposed)
lib/
  types.ts              # Shared TypeScript interfaces
  parse-google-url.ts   # Parses all Google Maps URL formats
  google-api.ts         # Places API + Geocoding API calls
  apple-maps.ts         # Builds Apple Maps URLs
```

## API

### `POST /api/convert`

**Request**
```json
{ "url": "https://maps.app.goo.gl/..." }
```

**Response — place**
```json
{
  "type": "place",
  "location": { "name": "Eiffel Tower", "formattedAddress": "...", "lat": 48.858, "lng": 2.294 },
  "appleUrl": "https://maps.apple.com/?ll=48.858%2C2.294&q=Eiffel+Tower"
}
```

**Response — directions**
```json
{
  "type": "directions",
  "stops": [...],
  "appleUrl": "https://maps.apple.com/?saddr=...&daddr=...&dirflg=d",
  "legs": [{ "from": {}, "to": {}, "appleUrl": "..." }],
  "isMultiStop": false
}
```

**Error**
```json
{ "error": "Human-readable message" }
```

## Limitations

- **Multi-stop directions**: Apple Maps URL scheme only supports one origin and one destination. The app outputs an origin→destination link plus individual leg links for each consecutive stop pair.
- **Place name matching**: Uses Google-resolved coordinates. The pin lands at the exact same geographic point; Apple's label for the place may differ from Google's name.

## Security

- `GOOGLE_MAPS_API_KEY` is a server-side environment variable — never sent to the browser
- Input URLs are validated against Google Maps domains before any API call
- URL length is capped at 2 048 characters
- Internal errors are logged server-side but never exposed in API responses

## Contributing

Pull requests are welcome. Please open an issue first for significant changes.

## License

MIT
