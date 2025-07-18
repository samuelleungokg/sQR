import os
import cairosvg

# Sizes for the icons
SIZES = [16, 32, 48, 128]

def generate_icons():
    # Get the directory of this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Input SVG file
    svg_file = os.path.join(script_dir, 'icon.svg')
    
    # Generate PNG files for each size
    for size in SIZES:
        output_file = os.path.join(script_dir, f'icon{size}.png')
        cairosvg.svg2png(
            url=svg_file,
            write_to=output_file,
            output_width=size,
            output_height=size
        )
        print(f"Generated {output_file}")

if __name__ == '__main__':
    generate_icons() 