/**
 * Starter catalogue for a Tamil Nadu hardware shop. Prices are typical retail
 * (₹) and only a starting point; GST rates follow the Sept-2025 slabs.
 * `aliases` are Tamil script and Tanglish words used by voice matching.
 */
export interface SeedProduct {
  name: string;
  aliases: string[];
  unit: string;
  price: number;
  hsn: string;
  gst: number;
  category: string;
}

const P = (name: string, aliases: string, unit: string, price: number, hsn: string, gst: number, category: string): SeedProduct => ({
  name,
  aliases: aliases.split(',').map((a) => a.trim()).filter(Boolean),
  unit,
  price,
  hsn,
  gst,
  category,
});

export const HARDWARE_CATALOG: SeedProduct[] = [
  P('PVC Pipe 1/2 inch', 'பிவிசி பைப், குழாய், pvc pipe, paipu, kuzhai, half inch pipe', 'PCS', 180, '3917', 18, 'Plumbing'),
  P('PVC Pipe 3/4 inch', 'பிவிசி பைப், குழாய், pvc pipe, paipu, kuzhai', 'PCS', 240, '3917', 18, 'Plumbing'),
  P('PVC Pipe 1 inch', 'பிவிசி பைப், குழாய், pvc pipe, paipu, kuzhai, one inch pipe', 'PCS', 320, '3917', 18, 'Plumbing'),
  P('PVC Elbow 1/2 inch', 'எல்போ, elbow, elbo, valaivu', 'PCS', 12, '3917', 18, 'Plumbing'),
  P('PVC Elbow 1 inch', 'எல்போ, elbow, elbo', 'PCS', 25, '3917', 18, 'Plumbing'),
  P('PVC Tee 1/2 inch', 'டீ ஜாயின்ட், tee, tee joint', 'PCS', 15, '3917', 18, 'Plumbing'),
  P('PVC Coupler 1/2 inch', 'கப்ளர், coupler, socket, joint', 'PCS', 10, '3917', 18, 'Plumbing'),
  P('Ball Valve 1/2 inch', 'வால்வு, valve, ball valve, vaalvu', 'PCS', 150, '8481', 18, 'Plumbing'),
  P('Ball Valve 1 inch', 'வால்வு, valve, ball valve', 'PCS', 290, '8481', 18, 'Plumbing'),
  P('Water Tap Brass', 'டேப், குழாய், tap, pipe tap, kuzhai tap, nal', 'PCS', 350, '8481', 18, 'Plumbing'),
  P('Water Tap PVC', 'டேப், tap, plastic tap', 'PCS', 90, '8481', 18, 'Plumbing'),
  P('Shower Head', 'ஷவர், shower', 'PCS', 450, '8481', 18, 'Plumbing'),
  P('Teflon Tape', 'டெஃப்லான் டேப், teflon, thread tape, plumber tape', 'PCS', 15, '3919', 18, 'Plumbing'),
  P('Solvent Cement 100ml', 'சால்வென்ட், solvent, pipe gum, pvc gum', 'PCS', 120, '3506', 18, 'Plumbing'),
  P('Wood Screw 1 inch (box of 100)', 'ஸ்க்ரூ, திருகாணி, screw, screws, scru, thirugani', 'BOX', 90, '7318', 18, 'Hardware'),
  P('Wood Screw 2 inch (box of 100)', 'ஸ்க்ரூ, screw, screws, scru', 'BOX', 150, '7318', 18, 'Hardware'),
  P('Drywall Screw (box of 500)', 'ஸ்க்ரூ, drywall screw, screws', 'BOX', 220, '7318', 18, 'Hardware'),
  P('Wire Nails 2 inch', 'ஆணி, aani, nail, nails, kambi aani', 'KG', 95, '7317', 18, 'Hardware'),
  P('Wire Nails 3 inch', 'ஆணி, aani, nail, nails', 'KG', 95, '7317', 18, 'Hardware'),
  P('Concrete Nails', 'ஆணி, concrete nail, suvar aani', 'BOX', 120, '7317', 18, 'Hardware'),
  P('Hex Bolt and Nut 10mm', 'போல்ட், நட், bolt, nut, bolt nut, boltu', 'PCS', 12, '7318', 18, 'Hardware'),
  P('Washer 10mm', 'வாஷர், washer, vasher', 'PCS', 2, '7318', 18, 'Hardware'),
  P('Anchor Fastener / Rawl Plug', 'ராவல் பிளக், plug, rawl plug, gitti, anchor', 'PKT', 40, '3926', 18, 'Hardware'),
  P('Door Hinge 4 inch', 'கீல், hinge, hinges, keel, kabja', 'PCS', 60, '8302', 18, 'Hardware'),
  P('Tower Bolt 6 inch', 'டவர் போல்ட், tower bolt, thazhppal', 'PCS', 70, '8302', 18, 'Hardware'),
  P('Door Handle', 'கைப்பிடி, handle, kaippidi', 'PCS', 120, '8302', 18, 'Hardware'),
  P('Padlock 50mm', 'பூட்டு, lock, poottu, pootu, padlock', 'PCS', 250, '8301', 18, 'Hardware'),
  P('Door Lock (mortise)', 'பூட்டு, door lock, poottu', 'PCS', 850, '8301', 18, 'Hardware'),
  P('Interior Emulsion Paint 1L', 'பெயிண்ட், paint, peint, vannam, emulsion', 'LTR', 320, '3209', 18, 'Paints'),
  P('Interior Emulsion Paint 4L', 'பெயிண்ட், paint, emulsion 4 litre', 'CAN', 1200, '3209', 18, 'Paints'),
  P('Enamel Paint 1L', 'எனாமல், enamel, enamel paint, peint', 'LTR', 380, '3208', 18, 'Paints'),
  P('Primer 1L', 'பிரைமர், primer', 'LTR', 260, '3209', 18, 'Paints'),
  P('Wall Putty 20kg', 'புட்டி, putty, wall putty, putti', 'BAG', 850, '3214', 18, 'Paints'),
  P('Paint Brush 2 inch', 'பிரஷ், brush, paint brush, brushu', 'PCS', 60, '9603', 18, 'Paints'),
  P('Paint Roller 9 inch', 'ரோலர், roller', 'PCS', 180, '9603', 18, 'Paints'),
  P('Thinner 1L', 'தின்னர், thinner', 'LTR', 140, '3814', 18, 'Paints'),
  P('Sandpaper', 'உப்புத்தாள், sandpaper, uppu thaal, emery paper', 'PCS', 10, '6805', 18, 'Paints'),
  P('Cement 50kg (OPC)', 'சிமெண்ட், cement, siment, simentu', 'BAG', 400, '2523', 18, 'Building Materials'),
  P('White Cement 1kg', 'வெள்ளை சிமெண்ட், white cement', 'KG', 45, '2523', 18, 'Building Materials'),
  P('Copper Wire 1.0 sq mm (90m)', 'வயர், கம்பி, wire, wayar, kambi, copper wire', 'ROLL', 1350, '8544', 18, 'Electricals'),
  P('Copper Wire 1.5 sq mm (90m)', 'வயர், wire, wayar, kambi', 'ROLL', 1900, '8544', 18, 'Electricals'),
  P('Copper Wire 2.5 sq mm (90m)', 'வயர், wire, wayar', 'ROLL', 3100, '8544', 18, 'Electricals'),
  P('Modular Switch 6A', 'சுவிட்ச், switch, suvich, switchu', 'PCS', 45, '8536', 18, 'Electricals'),
  P('Modular Socket 6A', 'சாக்கெட், socket, plug point', 'PCS', 70, '8536', 18, 'Electricals'),
  P('MCB 16A Single Pole', 'எம்சிபி, mcb, breaker', 'PCS', 220, '8536', 18, 'Electricals'),
  P('LED Bulb 9W', 'பல்பு, bulb, balbu, led bulb, light', 'PCS', 90, '8539', 18, 'Electricals'),
  P('LED Tube Light 20W', 'டியூப் லைட், tube light, tube', 'PCS', 280, '8539', 18, 'Electricals'),
  P('Ceiling Fan', 'ஃபேன், மின்விசிறி, fan, minvisiri', 'PCS', 1800, '8414', 18, 'Electricals'),
  P('Insulation Tape', 'இன்சுலேஷன் டேப், tape, insulation tape, black tape', 'PCS', 20, '3919', 18, 'Electricals'),
  P('Extension Board 4 Socket', 'எக்ஸ்டென்ஷன், extension board, spike', 'PCS', 350, '8537', 18, 'Electricals'),
  P('Fevicol SH 1kg', 'ஃபெவிகால், fevicol, gum, pasai', 'KG', 380, '3506', 18, 'Hardware'),
  P('M-Seal 100g', 'எம் சீல், mseal, m seal', 'PCS', 60, '3506', 18, 'Hardware'),
  P('Hammer 500g', 'சுத்தியல், hammer, suthiyal, suthi', 'PCS', 280, '8205', 18, 'Tools'),
  P('Screwdriver Set', 'ஸ்க்ரூ டிரைவர், screwdriver, tester, scru driver', 'SET', 180, '8205', 18, 'Tools'),
  P('Spanner Set', 'ஸ்பானர், spanner, spaanar, wrench', 'SET', 450, '8204', 18, 'Tools'),
  P('Pliers 8 inch', 'கட்டிங் பிளேயர், pliers, cutting plier, plier', 'PCS', 220, '8203', 18, 'Tools'),
  P('Drill Bit Set', 'டிரில் பிட், drill bit, drill', 'SET', 350, '8207', 18, 'Tools'),
  P('Measuring Tape 5m', 'அளவு டேப், measuring tape, tape measure, alavu tape', 'PCS', 150, '9017', 18, 'Tools'),
  P('Hacksaw Blade', 'ரம்பம், hacksaw, blade, rambam', 'PCS', 30, '8202', 18, 'Tools'),
  P('Mason Trowel', 'கரண்டி, trowel, karandi', 'PCS', 120, '8205', 18, 'Tools'),
  P('Binding Wire', 'கட்டு கம்பி, binding wire, kattu kambi', 'KG', 90, '7217', 18, 'Building Materials'),
];

/** Lower-case product name → aliases, for voice matching. */
export const SEED_ALIASES: Record<string, string[]> = Object.fromEntries(
  HARDWARE_CATALOG.map((p) => [p.name.toLowerCase(), p.aliases])
);
