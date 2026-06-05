# UEC campus map extraction

Source: `map.pdf`, page 1.

Files:
- `uec_campus_map.svg`: faithful SVG crop of the main campus map only. Legend, access mini-map, and copyright area are excluded visually.
- `uec_campus_map_layers.svg`: simplified layer SVG with separate `roads`, `buildings`, and `labels` groups.
- `uec_campus_buildings.csv`: blue building/building-part shapes extracted from PDF vector data.
- `uec_campus_building_labels.csv`: numbered building labels and names.
- `uec_campus_roads.csv`: clean road/walkway area extracted from PDF vector data.
- `uec_campus_roads_linework.csv`: optional gray linework extracted from the map. This is kept separate because it includes road/path outlines and minor map linework.

Coordinate system:
- Unit: PDF/SVG point-like coordinate in the cropped SVG viewBox.
- Origin: top-left of the cropped main map.
- ViewBox: `0 0 580 490`.
- Crop used from original PDF page: x=10, y=15, width=580, height=490.

Notes:
- Building-to-number assignment is based on nearest visible number label. Assignment quality is included in `uec_campus_buildings.csv`.
- Rows are geometry parts, not necessarily one physical building per row, because some buildings are drawn as multiple separated PDF paths.
- Names for 74 and 75 are not written in the provided PDF map, so they are marked accordingly.
