#!/usr/bin/env python3
import sys
import time
import argparse
import numpy as np
from numba import jit
from PIL import Image

# 1. Accelerated mathematical computation with Numba JIT (Compiled to LLVM machine code)
@jit(nopython=True, fastmath=True)
def compute_mandelbrot(width, height, xmin, xmax, ymin, ymax, max_iter):
    """
    Computes the iteration matrix for the Mandelbrot set.
    Returns a 2D NumPy array with the iteration count per pixel.
    """
    matrix = np.zeros((height, width), dtype=np.uint32)
    x_step = (xmax - xmin) / width
    y_step = (ymax - ymin) / height

    for row in range(height):
        cy = ymin + row * y_step
        for col in range(width):
            cx = xmin + col * x_step
            
            # z_0 = 0, c = cx + cy*i
            zx = 0.0
            zy = 0.0
            iteration = 0
            
            # Escape criterion: |z|^2 <= 4.0
            while zx * zx + zy * zy <= 4.0 and iteration < max_iter:
                xtemp = zx * zx - zy * zy + cx
                zy = 2.0 * zx * zy + cy
                zx = xtemp
                iteration += 1
            
            matrix[row, col] = iteration
            
    return matrix


# 2. RGB color palette mapping
def apply_palette(matrix, max_iter):
    """
    Maps the iteration matrix to an RGB color image using sine-wave gradients.
    """
    normalized = matrix / max_iter
    
    # Color channels with phase shifts for smooth color gradients
    r = (np.sin(normalized * 12.0) * 0.5 + 0.5) * 255
    g = (np.sin(normalized * 12.0 + 2.0) * 0.5 + 0.5) * 255
    b = (np.sin(normalized * 12.0 + 4.0) * 0.5 + 0.5) * 255
    
    # Points inside the Mandelbrot set (did not escape) are set to pure black
    mask = (matrix == max_iter)
    r[mask] = 0
    g[mask] = 0
    b[mask] = 0
    
    rgb = np.stack([r, g, b], axis=-1).astype(np.uint8)
    return rgb


# 3. CLI Interface and main execution flow
def main():
    usage_epilog = """
Examples of usage:
  # Default 1080p render
  python3 mandelbrok8s.py --width 1920 --height 1080 --iterations 1000 --output fractal.png

  # Deep zoom into Seahorse Valley
  python3 mandelbrok8s.py --width 3840 --height 2160 --iterations 2000 --center-x -0.743643887 --center-y 0.131825904 --zoom 150.0 --output seahorse.png

  # Low-res fast preview
  python3 mandelbrok8s.py --width 640 --height 360 --iterations 250 --output preview.png
"""

    parser = argparse.ArgumentParser(
        description="Mandelbrok8s Fractal Engine (Numba JIT)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=usage_epilog
    )

    parser.add_argument("--width", type=int, default=1920, help="Image width in pixels (default: 1920)")
    parser.add_argument("--height", type=int, default=1080, help="Image height in pixels (default: 1080)")
    parser.add_argument("--iterations", type=int, default=1000, help="Maximum iteration limit (default: 1000)")
    parser.add_argument("--center-x", type=float, default=-0.5, help="Center X coordinate in complex plane (default: -0.5)")
    parser.add_argument("--center-y", type=float, default=0.0, help="Center Y coordinate in complex plane (default: 0.0)")
    parser.add_argument("--zoom", type=float, default=1.0, help="Zoom level multiplier (default: 1.0)")
    parser.add_argument("--output", type=str, default="mandelbrok8s.png", help="Output PNG file path (default: mandelbrok8s.png)")

    args = parser.parse_args()

    # Calculate bounding box (xmin, xmax, ymin, ymax) adjusted to aspect ratio
    aspect_ratio = args.width / args.height
    span_y = 2.0 / args.zoom
    span_x = span_y * aspect_ratio

    xmin = args.center_x - (span_x / 2.0)
    xmax = args.center_x + (span_x / 2.0)
    ymin = args.center_y - (span_y / 2.0)
    ymax = args.center_y + (span_y / 2.0)

    start_time = time.time()

    # Accelerated JIT computation
    iterations_matrix = compute_mandelbrot(
        args.width, args.height, xmin, xmax, ymin, ymax, args.iterations
    )

    # Apply color palette and save PNG
    rgb_image = apply_palette(iterations_matrix, args.iterations)
    img = Image.fromarray(rgb_image)
    img.save(args.output, "PNG")

    elapsed = time.time() - start_time

    # Structured stdout for Node.js worker metric parsing
    print(f"SUCCESS|output={args.output}|render_time_sec={elapsed:.4f}")


if __name__ == "__main__":
    main()
