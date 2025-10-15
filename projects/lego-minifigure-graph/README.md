# A Galaxy of Minifigs

An interactive 3D network visualization exploring the co-appearances of LEGO Star Wars minifigures across different sets. Discover which characters have appeared together in LEGO sets since 1999!

> ⚠️ **Legal Notice**: This is a fan-made, non-commercial project for educational purposes only. LEGO®, Star Wars™, and all related trademarks are property of The LEGO Group, Lucasfilm Ltd., and Disney. This project is not affiliated with, endorsed by, or sponsored by these companies. Commercial use is strictly prohibited.

## About

This project visualizes the relationships between LEGO Star Wars minifigures by showing which characters have appeared together in the same sets. Each minifigure is represented as a 3D stud (1x1 round plate piece), with connections showing shared set appearances.

### Key Features

- **Interactive 3D Network**: Rotating sphere of minifigures with real-time interaction
- **Smart Search**: Find specific characters with instant filtering
- **Set Exploration**: View all sets containing a selected character, organized by year
- **Association Analysis**: Discover which characters appear together most frequently
- **Dynamic Highlighting**: Click any character to see their network of connections

## How to Use

1. **Explore the Network**: The 3D sphere rotates automatically - use the play/pause button to control
2. **Search Characters**: Use the search box to find specific minifigures
3. **Select a Character**: Click any stud in the 3D view or bar in the left panel
4. **View Sets**: See all sets containing that character, organized by year. Clicking the set name loads it in Rebrickable.
5. **Find Associates**: Check the right panel to see which characters appear together most often
6. **Zoom**: Use the zoom slider to get closer or further from the action

## Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **3D Graphics**: Three.js (v0.126.1)
- **Network Visualization**: 3d-force-graph
- **Data Visualization**: D3.js (v7)
- **Data Analysis**: Python
- **Data Source**: [Rebrickable](https://rebrickable.com)

## Data

The visualization uses data from Rebrickable, processed to show:
- **Minifigures**: 500+ Star Wars characters
- **Sets**: All LEGO Star Wars sets from 1999-2025
- **Connections**: Co-appearances in the same sets
- **Node Size**: Based on number of set appearances

### Data Limitations

**Please note**: This visualization is based on publicly available data from Rebrickable as of September 2025 and may not include every LEGO Star Wars set or minifigure. Some sets may be missing from the dataset, and the network connections represent only the data that was available at the time of processing. The visualization should be considered a representative sample rather than a complete dataset.

**Data Quality**: While efforts have been made to ensure accuracy, the data may contain inconsistencies or omissions. If you notice specific missing sets or characters, please feel free to report them as issues on GitHub.

## Getting Started

### Prerequisites
- A modern web browser (Chrome, Firefox, Safari, Edge)
- No additional software required!

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/bballerstein/portfolio.git
   cd portfolio/projects/lego-minifigure-graph
   ```

2. **Serve the files**
   Since the project loads local JSON files, you'll need a local server:
   
   **Option A: Python (if installed)**
   ```bash
   python -m http.server 8000
   ```
   
   **Option B: Node.js (if installed)**
   ```bash
   npx serve .
   ```
   
   **Option C: VS Code Live Server extension**
   - Install the "Live Server" extension
   - Right-click `index.html` and select "Open with Live Server"

3. **Open in browser**
   Navigate to `http://localhost:8000` (or the port shown by your server)

## 📁 Project Structure

```
lego-minifigure-graph/
├── index.html              # Main HTML file
├── script.js               # Core JavaScript logic
├── styles.css              # Styling and layout
├── data/
│   └── lego_starwars_graph_v2.json  # Network data
├── models/
│   ├── stud2.obj           # 3D stud model
└── README.md               # This file
```

## Customization

### Adding New Characters
1. Update the JSON data file with new minifigure information
2. Ensure the data follows the existing structure with `nodes` and `links` arrays

### Styling Changes
- Modify `styles.css` for visual customizations
- Update colors, fonts, and layout as needed

### Functionality Extensions
- Add new interaction modes in `script.js`
- Implement additional filtering options
- Add export functionality for network data

## Contributing

Contributions are welcome! Here's how you can help:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit your changes** (`git commit -m 'Add amazing feature'`)
4. **Push to the branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

### Areas for Contribution
- Mobile responsiveness improvements
- Additional visualization modes
- Performance optimizations
- New data analysis features
- Bug fixes and code improvements

## License

This project is licensed under the Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License - see the [LICENSE](LICENSE) file for details.

**Important**: This is a non-commercial project. Commercial use is strictly prohibited. All LEGO® and Star Wars™ trademarks remain property of their respective owners.

## Acknowledgments

- **Data Source**: [Rebrickable](https://rebrickable.com) for providing comprehensive LEGO set data
- **3D Graphics**: Three.js community for excellent documentation and examples
- **Visualization**: 3d-force-graph for the network visualization framework
- **LEGO Group**: For creating the amazing Star Wars minifigures that inspired this project
- **Lucasfilm**: For the Star Wars universe that makes this data meaningful

## Contact

**Benjamin Ballerstein**
- LinkedIn: [linkedin.com/in/bballerstein](https://www.linkedin.com/in/bballerstein)
- GitHub: [@bballerstein](https://github.com/bballerstein)

## Disclaimer

This is a fan-made, non-commercial project created for educational and entertainment purposes. LEGO®, Star Wars™, and Rebrickable® are trademarks of their respective owners and are not affiliated with or endorsed by this site.
