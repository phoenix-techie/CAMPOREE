import React, { useMemo, useState } from 'react';
import {
  Compass,
  Edit3,
  MapPin,
  Navigation,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useCamporee } from '../context/CamporeeContext';
import { sanitizeFirestoreId } from '../lib/qrParser';
import { CampLocation, LocationCategory, LocationStatus } from '../types/camporee';
import { ConfirmDialog } from './ConfirmDialog';

const CATEGORY_LABELS: Record<LocationCategory, string> = {
  hq: 'Camp HQ',
  subcamp: 'Sub-Camp',
  venue: 'Program Venue',
  adventure: 'Adventure Base',
  facility: 'Facility / Medical',
};

const CATEGORY_PIN_COLOR: Record<LocationCategory, string> = {
  hq: '#1B4332',
  subcamp: '#2D6A4F',
  venue: '#0F766E',
  adventure: '#B45309',
  facility: '#B91C1C',
};

export const CampMapSection: React.FC = () => {
  const { role, locations, activities, saveLocation, deleteLocation } = useCamporee();
  const isAdmin = role === 'admin';

  const [categoryFilter, setCategoryFilter] = useState<'all' | LocationCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Admin map editing state
  const [placeMode, setPlaceMode] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<CampLocation | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CampLocation | null>(null);
  const [saving, setSaving] = useState(false);

  const [formState, setFormState] = useState<{
    name: string;
    category: LocationCategory;
    sector: string;
    description: string;
    directions: string;
    mapX: number;
    mapY: number;
    coordinatesLabel: string;
    status: LocationStatus;
  }>({
    name: '',
    category: 'venue',
    sector: 'Sector A',
    description: '',
    directions: '',
    mapX: 50,
    mapY: 50,
    coordinatesLabel: '',
    status: 'open',
  });

  const filteredLocations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return locations.filter((loc) => {
      if (categoryFilter !== 'all' && loc.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        loc.name.toLowerCase().includes(q) ||
        loc.sector.toLowerCase().includes(q) ||
        (loc.description || '').toLowerCase().includes(q)
      );
    });
  }, [locations, categoryFilter, searchQuery]);

  const selectedLocation = useMemo(() => {
    if (selectedId) {
      return locations.find((l) => l.id === selectedId) || null;
    }
    return filteredLocations[0] || locations[0] || null;
  }, [selectedId, locations, filteredLocations]);

  const relatedActivities = useMemo(() => {
    if (!selectedLocation) return [];
    const locNameLower = selectedLocation.name.toLowerCase();
    const sectorFirst = selectedLocation.sector.split('·')[0].trim().toLowerCase();
    return activities.filter(
      (a) =>
        a.venueName.toLowerCase().includes(locNameLower.split(' ')[0]) ||
        (a.description || '').toLowerCase().includes(sectorFirst)
    );
  }, [selectedLocation, activities]);

  const openNewEditor = (coords?: { x: number; y: number }) => {
    setEditingLocation(null);
    setFormState({
      name: '',
      category: 'venue',
      sector: 'Sector A · Central',
      description: '',
      directions: '',
      mapX: coords ? Math.round(coords.x) : 50,
      mapY: coords ? Math.round(coords.y) : 50,
      coordinatesLabel: coords ? `Grid ${Math.round(coords.x)}:${Math.round(coords.y)}` : '',
      status: 'open',
    });
    setEditorOpen(true);
    setPlaceMode(false);
  };

  const openEditEditor = (loc: CampLocation) => {
    setEditingLocation(loc);
    setFormState({
      name: loc.name,
      category: loc.category,
      sector: loc.sector,
      description: loc.description || '',
      directions: loc.directions || '',
      mapX: loc.mapX,
      mapY: loc.mapY,
      coordinatesLabel: loc.coordinatesLabel || '',
      status: loc.status,
    });
    setEditorOpen(true);
    setPlaceMode(false);
  };

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isAdmin || !placeMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    openNewEditor({ x, y });
  };

  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setSaving(true);
    try {
      const id = editingLocation?.id || sanitizeFirestoreId('loc', formState.name);
      await saveLocation(
        {
          id,
          ...formState,
        },
        !editingLocation
      );
      setSelectedId(id);
      setEditorOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await deleteLocation(deleteTarget.id);
      if (selectedId === deleteTarget.id) setSelectedId(null);
      setDeleteTarget(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#141A15]">
            Camporee Site Map & Location Finder
          </h1>
          <p className="text-sm text-[#5C665E]">
            Locate main camp HQ, sub-camps, program venues, and adventure bases. Future updates
            will add GPS turn-by-turn walking navigation.
          </p>
        </div>

        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setPlaceMode((prev) => !prev)}
              className={`min-h-[40px] px-4 py-2 text-xs font-semibold rounded-lg border transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                placeMode
                  ? 'bg-[#B45309] text-white border-[#B45309]'
                  : 'bg-white text-[#141A15] border-[#CFD8CF] hover:bg-[#F1F4F1]'
              }`}
            >
              <MapPin className="h-3.5 w-3.5" />
              <span>{placeMode ? 'Click Map to Place Pin...' : 'Place Pin on Map'}</span>
            </button>
            <button
              type="button"
              onClick={() => openNewEditor()}
              className="min-h-[40px] px-4 py-2 bg-[#1B4332] text-white text-xs font-semibold rounded-lg hover:bg-[#143325] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>Add Camp Location</span>
            </button>
          </div>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white border border-[#DDE4DD] rounded-xl p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0">
          {(
            [
              { id: 'all', label: 'All Zones' },
              { id: 'hq', label: 'Camp HQ' },
              { id: 'subcamp', label: 'Sub-Camps' },
              { id: 'venue', label: 'Program Venues' },
              { id: 'adventure', label: 'Adventure Bases' },
              { id: 'facility', label: 'Facilities' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCategoryFilter(tab.id)}
              className={`min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                categoryFilter === tab.id
                  ? 'bg-[#1B4332] text-white'
                  : 'text-[#424B44] hover:bg-[#F1F4F1]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full lg:w-72">
          <Search className="h-4 w-4 text-[#5C665E] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Find venue, sub-camp, or sector..."
            className="w-full h-10 pl-9 pr-3 text-sm bg-[#F7F8F5] border border-[#D4DDD4] rounded-lg focus:outline-none focus:border-[#1B4332]"
          />
        </div>
      </div>

      {/* Interactive Map + Location Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Topographic Interactive Camporee Map */}
        <div className="lg:col-span-8 bg-white border border-[#DDE4DD] rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#EEF2EE] flex flex-wrap items-center justify-between gap-2 text-xs text-[#5C665E]">
            <div className="flex items-center gap-2 font-medium">
              <Compass className="h-4 w-4 text-[#1B4332]" />
              <span>Topographic Ground Plan · Click any pin to view directions</span>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              {(['hq', 'subcamp', 'venue', 'adventure', 'facility'] as LocationCategory[]).map(
                (cat) => (
                  <span key={cat} className="inline-flex items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 rounded-full inline-block"
                      style={{ backgroundColor: CATEGORY_PIN_COLOR[cat] }}
                    />
                    <span>{CATEGORY_LABELS[cat]}</span>
                  </span>
                )
              )}
            </div>
          </div>

          <div className="relative bg-[#EEF3EB]">
            <svg
              viewBox="0 0 100 68"
              onClick={handleSvgClick}
              className={`w-full h-auto block select-none ${
                placeMode ? 'cursor-crosshair' : 'cursor-default'
              }`}
              role="img"
              aria-label="Kerala State Camporee Ground Map"
            >
              {/* Terrain backdrop & contour rings */}
              <rect x="0" y="0" width="100" height="68" fill="#EBF2E7" />
              <ellipse cx="48" cy="34" rx="44" ry="28" fill="#E3ECE0" stroke="#D2DFCE" strokeWidth="0.3" />
              <ellipse cx="48" cy="34" rx="31" ry="19" fill="#DCE8D8" stroke="#C8D9C3" strokeWidth="0.3" />

              {/* Grid coordinates */}
              {[20, 40, 60, 80].map((x) => (
                <line
                  key={`gx-${x}`}
                  x1={x}
                  y1="0"
                  x2={x}
                  y2="68"
                  stroke="#CBD8C7"
                  strokeWidth="0.18"
                  strokeDasharray="1 1"
                />
              ))}
              {[17, 34, 51].map((y) => (
                <line
                  key={`gy-${y}`}
                  x1="0"
                  y1={y}
                  x2="100"
                  y2={y}
                  stroke="#CBD8C7"
                  strokeWidth="0.18"
                  strokeDasharray="1 1"
                />
              ))}

              {/* Main pathways */}
              <path
                d="M 52 65 L 48 34 L 24 16 M 48 34 L 76 22 M 48 34 L 20 35 M 48 34 L 78 48 L 68 56 M 48 34 L 30 55"
                fill="none"
                stroke="#F7F8F5"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M 52 65 L 48 34 L 24 16 M 48 34 L 76 22 M 48 34 L 20 35 M 48 34 L 78 48 L 68 56 M 48 34 L 30 55"
                fill="none"
                stroke="#C9C4B5"
                strokeWidth="0.35"
                strokeDasharray="1.2 0.8"
              />

              {/* Sector Zone Labels */}
              <text x="14" y="9" fontSize="2.2" fill="#5A6E5C" fontWeight="600">
                SECTOR B · NORTH
              </text>
              <text x="72" y="9" fontSize="2.2" fill="#5A6E5C" fontWeight="600">
                SECTOR C · EAST
              </text>
              <text x="14" y="64" fontSize="2.2" fill="#5A6E5C" fontWeight="600">
                SECTOR D · SOUTH
              </text>
              <text x="70" y="64" fontSize="2.2" fill="#92400E" fontWeight="600">
                SECTOR E · ADVENTURE VALLEY
              </text>

              {/* Main Entrance Gate Marker */}
              <rect x="46" y="63.5" width="12" height="3.2" rx="0.8" fill="#1B4332" />
              <text x="52" y="65.7" fontSize="1.7" fill="#FFFFFF" textAnchor="middle" fontWeight="600">
                MAIN GATE
              </text>

              {/* Compass Rose */}
              <g transform="translate(93, 8)">
                <circle cx="0" cy="0" r="3.4" fill="#FFFFFF" fillOpacity="0.85" stroke="#B7C5B7" strokeWidth="0.25" />
                <path d="M 0 -2.4 L 0.9 1.2 L 0 0.4 L -0.9 1.2 Z" fill="#1B4332" />
                <text x="0" y="-3.9" fontSize="1.6" fill="#1B4332" textAnchor="middle" fontWeight="700">
                  N
                </text>
              </g>

              {/* Interactive Location Pins */}
              {filteredLocations.map((loc) => {
                const cy = (loc.mapY / 100) * 62 + 3;
                const cx = Math.max(5, Math.min(95, loc.mapX));
                const isSelected = selectedLocation?.id === loc.id;
                const color = CATEGORY_PIN_COLOR[loc.category] || '#1B4332';

                return (
                  <g
                    key={loc.id}
                    transform={`translate(${cx}, ${cy})`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedId(loc.id);
                    }}
                    className="cursor-pointer"
                  >
                    {isSelected && (
                      <circle cx="0" cy="0" r="3.8" fill={color} fillOpacity="0.2" />
                    )}
                    <circle
                      cx="0"
                      cy="0"
                      r={isSelected ? 2.1 : 1.7}
                      fill={color}
                      stroke="#FFFFFF"
                      strokeWidth="0.55"
                    />
                    <rect
                      x="-11"
                      y="2.4"
                      width="22"
                      height="3.2"
                      rx="0.8"
                      fill={isSelected ? '#141A15' : '#FFFFFF'}
                      fillOpacity={isSelected ? 0.92 : 0.9}
                      stroke={isSelected ? '#141A15' : '#CBD6CB'}
                      strokeWidth="0.2"
                    />
                    <text
                      x="0"
                      y="4.6"
                      fontSize="1.65"
                      fontWeight="600"
                      textAnchor="middle"
                      fill={isSelected ? '#FFFFFF' : '#141A15'}
                    >
                      {loc.name.length > 18 ? `${loc.name.slice(0, 17)}…` : loc.name}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Right Side: Location Inspector & Directory */}
        <div className="lg:col-span-4 space-y-4">
          {selectedLocation ? (
            <div className="bg-white border border-[#DDE4DD] rounded-2xl p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-[#5C665E]">
                    <span
                      className="font-semibold"
                      style={{ color: CATEGORY_PIN_COLOR[selectedLocation.category] }}
                    >
                      {CATEGORY_LABELS[selectedLocation.category]}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{selectedLocation.sector}</span>
                  </div>
                  <h2 className="font-display text-lg font-bold text-[#141A15]">
                    {selectedLocation.name}
                  </h2>
                </div>

                {isAdmin && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditEditor(selectedLocation)}
                      className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg border border-[#D4DDD4] text-[#424B44] hover:bg-[#F1F4F1]"
                      title="Edit location"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(selectedLocation)}
                      className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg border border-[#D4DDD4] text-red-700 hover:bg-red-50"
                      title="Delete location"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {selectedLocation.description && (
                <p className="text-sm text-[#424B44] leading-relaxed">
                  {selectedLocation.description}
                </p>
              )}

              <div className="rounded-xl bg-[#F7F8F5] border border-[#E2E8E2] p-3.5 space-y-2 text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-[#1B4332]">
                  <Navigation className="h-3.5 w-3.5" />
                  <span>Walking Directions</span>
                </div>
                <p className="text-[#424B44] leading-relaxed">
                  {selectedLocation.directions ||
                    'Follow sector signage from the Central Flag Arena.'}
                </p>
                <div className="pt-1 border-t border-[#E2E8E2] flex items-center justify-between text-[#5C665E] font-mono tabular-nums">
                  <span>
                    {selectedLocation.coordinatesLabel ||
                      `Grid ${Math.round(selectedLocation.mapX)}:${Math.round(selectedLocation.mapY)}`}
                  </span>
                  <span>
                    Status:{' '}
                    <strong className="text-[#141A15] capitalize">
                      {selectedLocation.status}
                    </strong>
                  </span>
                </div>
              </div>

              {relatedActivities.length > 0 && (
                <div className="space-y-2 pt-1">
                  <p className="text-xs font-semibold text-[#5C665E]">
                    Activities Near This Location
                  </p>
                  <div className="space-y-1.5">
                    {relatedActivities.slice(0, 3).map((act) => (
                      <div
                        key={act.id}
                        className="text-xs px-3 py-2 rounded-lg bg-[#FAFBF9] border border-[#E6ECE6] flex items-center justify-between gap-2"
                      >
                        <span className="font-medium text-[#141A15] truncate">{act.title}</span>
                        <span className="font-mono text-[#5C665E] tabular-nums shrink-0">
                          {act.startTime}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-[#DDE4DD] rounded-2xl p-6 text-center text-sm text-[#5C665E]">
              No camp locations match your filter yet.
            </div>
          )}

          {/* Quick Location Directory List */}
          <div className="bg-white border border-[#DDE4DD] rounded-2xl p-4 space-y-2">
            <p className="text-xs font-semibold text-[#5C665E] px-1">
              Directory ({filteredLocations.length})
            </p>
            <div className="max-h-64 overflow-y-auto divide-y divide-[#EEF2EE]">
              {filteredLocations.map((loc) => (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => setSelectedId(loc.id)}
                  className={`w-full text-left px-2.5 py-2.5 rounded-lg transition-colors flex items-center justify-between gap-2 ${
                    selectedLocation?.id === loc.id ? 'bg-[#EEF4EE]' : 'hover:bg-[#F7F8F5]'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#141A15] truncate">{loc.name}</p>
                    <p className="text-[11px] text-[#5C665E] truncate">{loc.sector}</p>
                  </div>
                  <span className="text-[11px] font-medium text-[#424B44] shrink-0">
                    {CATEGORY_LABELS[loc.category]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Admin Add/Edit Camp Location Modal */}
      {editorOpen && isAdmin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSaveLocation}
            className="w-full max-w-lg bg-white border border-[#DCE3DC] rounded-2xl shadow-xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#EEF2EE]">
              <h3 className="font-display text-lg font-bold text-[#141A15]">
                {editingLocation ? 'Update Camp Location' : 'Add Camp Location Pin'}
              </h3>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-[#5C665E] hover:bg-[#F1F4F1]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#424B44] mb-1">
                    Location Name
                  </label>
                  <input
                    required
                    value={formState.name}
                    onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                    placeholder="e.g. Sub-Camp Malabar (North)"
                    className="w-full h-10 px-3 text-sm border border-[#CFD8CF] rounded-lg focus:outline-none focus:border-[#1B4332]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#424B44] mb-1">
                    Category
                  </label>
                  <select
                    value={formState.category}
                    onChange={(e) =>
                      setFormState({ ...formState, category: e.target.value as LocationCategory })
                    }
                    className="w-full h-10 px-3 text-sm border border-[#CFD8CF] rounded-lg bg-white focus:outline-none focus:border-[#1B4332]"
                  >
                    <option value="hq">Camp HQ</option>
                    <option value="subcamp">Sub-Camp</option>
                    <option value="venue">Program Venue</option>
                    <option value="adventure">Adventure Base</option>
                    <option value="facility">Facility / Medical</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#424B44] mb-1">
                    Sector Label
                  </label>
                  <input
                    required
                    value={formState.sector}
                    onChange={(e) => setFormState({ ...formState, sector: e.target.value })}
                    placeholder="e.g. Sector B · North Meadow"
                    className="w-full h-10 px-3 text-sm border border-[#CFD8CF] rounded-lg focus:outline-none focus:border-[#1B4332]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#424B44] mb-1">
                    Map X Position (0–100)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    required
                    value={formState.mapX}
                    onChange={(e) => setFormState({ ...formState, mapX: Number(e.target.value) })}
                    className="w-full h-10 px-3 text-sm font-mono border border-[#CFD8CF] rounded-lg focus:outline-none focus:border-[#1B4332]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#424B44] mb-1">
                    Map Y Position (0–100)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    required
                    value={formState.mapY}
                    onChange={(e) => setFormState({ ...formState, mapY: Number(e.target.value) })}
                    className="w-full h-10 px-3 text-sm font-mono border border-[#CFD8CF] rounded-lg focus:outline-none focus:border-[#1B4332]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#424B44] mb-1">
                    Status
                  </label>
                  <select
                    value={formState.status}
                    onChange={(e) =>
                      setFormState({ ...formState, status: e.target.value as LocationStatus })
                    }
                    className="w-full h-10 px-3 text-sm border border-[#CFD8CF] rounded-lg bg-white focus:outline-none focus:border-[#1B4332]"
                  >
                    <option value="open">Open</option>
                    <option value="busy">Busy</option>
                    <option value="updating">Updating Coordinates</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#424B44] mb-1">
                    Coordinate Note
                  </label>
                  <input
                    value={formState.coordinatesLabel}
                    onChange={(e) =>
                      setFormState({ ...formState, coordinatesLabel: e.target.value })
                    }
                    placeholder="e.g. Sector B-04"
                    className="w-full h-10 px-3 text-sm border border-[#CFD8CF] rounded-lg focus:outline-none focus:border-[#1B4332]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#424B44] mb-1">
                    Directions from Central Arena / Main Gate
                  </label>
                  <input
                    value={formState.directions}
                    onChange={(e) => setFormState({ ...formState, directions: e.target.value })}
                    placeholder="Walk 120m north past Water Point 2..."
                    className="w-full h-10 px-3 text-sm border border-[#CFD8CF] rounded-lg focus:outline-none focus:border-[#1B4332]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#424B44] mb-1">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={formState.description}
                    onChange={(e) => setFormState({ ...formState, description: e.target.value })}
                    placeholder="Details about tents, capacity, or landmarks..."
                    className="w-full p-3 text-sm border border-[#CFD8CF] rounded-lg focus:outline-none focus:border-[#1B4332]"
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-[#FAFBF9] border-t border-[#EEF2EE] flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="min-h-[40px] px-4 py-2 text-sm font-medium text-[#424B44] bg-white border border-[#D4DDD4] rounded-lg hover:bg-[#F1F4F1]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="min-h-[40px] px-5 py-2 text-sm font-semibold text-white bg-[#1B4332] rounded-lg hover:bg-[#143325] disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save Location'}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Camp Location"
        description={`Remove "${deleteTarget?.name || ''}" from the Camporee interactive map?`}
        confirmLabel="Delete Location"
        tone="danger"
        busy={saving}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};
