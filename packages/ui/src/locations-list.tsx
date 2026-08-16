import type { PublicLocation } from '@qrhub/types';

/** A client's physical branches — address, phone, hours, and a "Get
 * directions" link built from the address text (no maps API/key needed,
 * just Google Maps' plain search-by-query URL). */
export function LocationsList({ locations }: { locations: PublicLocation[] }) {
  if (locations.length === 0) {
    return null;
  }

  const sorted = [...locations].sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div className="flex flex-col gap-3">
      {sorted.map((location) => (
        <div key={location.id} className="flex flex-col gap-1 rounded-lg border border-current/15 p-4 text-left text-sm">
          <p className="font-medium">{location.name}</p>
          <p className="text-gray-500">{location.address}</p>
          {location.hours ? <p className="text-gray-500">{location.hours}</p> : null}
          <div className="flex flex-wrap gap-3 pt-1">
            {location.phone ? (
              <a href={`tel:${location.phone}`} className="text-sm font-medium underline">
                Call
              </a>
            ) : null}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.address)}`}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium underline"
            >
              Get directions
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}
