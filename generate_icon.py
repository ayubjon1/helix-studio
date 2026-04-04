"""
Generate Helix Studio app icon — DNA helix + sound waves in amber/gold on dark background.
"""
import struct, zlib, os, math

def create_helix_icon(size, path):
    img = []
    center = size / 2
    radius = size * 0.38

    for y in range(size):
        row = []
        for x in range(size):
            dx = x - center
            dy = y - center
            dist = math.sqrt(dx * dx + dy * dy)

            r, g, b, a = 0, 0, 0, 0

            # ─── Background circle with gradient ───
            bg_radius = size * 0.46
            if dist <= bg_radius:
                edge = max(0, 1 - (dist / bg_radius) ** 8)  # sharp edge
                t = y / size
                # Dark gradient background
                br = int(18 + t * 10)
                bg = int(18 + t * 8)
                bb = int(22 + t * 12)
                a = int(255 * edge)
                r, g, b = br, bg, bb

                # ─── Subtle radial glow in center ───
                glow = max(0, 1 - (dist / (size * 0.3)) ** 2)
                r = min(255, int(r + glow * 15))
                g = min(255, int(g + glow * 10))
                b = min(255, int(b + glow * 5))

                # ─── DNA Helix strands ───
                # Parametric helix: two sine waves offset by pi
                norm_y = (y - size * 0.15) / (size * 0.7)  # 0 to 1 along the helix
                if 0 <= norm_y <= 1:
                    phase = norm_y * math.pi * 3.5  # 3.5 full twists

                    # Strand 1
                    strand1_x = center + math.sin(phase) * size * 0.16
                    strand1_dist = abs(x - strand1_x)

                    # Strand 2 (offset by pi)
                    strand2_x = center + math.sin(phase + math.pi) * size * 0.16
                    strand2_dist = abs(x - strand2_x)

                    # Strand thickness
                    thickness = size * 0.028
                    glow_thickness = size * 0.06

                    # Depth factor: which strand is in front
                    depth1 = math.cos(phase)  # -1 to 1
                    depth2 = math.cos(phase + math.pi)

                    # Brightness based on depth
                    bright1 = 0.5 + depth1 * 0.5  # 0 to 1
                    bright2 = 0.5 + depth2 * 0.5

                    # Draw strand glows
                    if strand1_dist < glow_thickness:
                        intensity = (1 - strand1_dist / glow_thickness) ** 2 * bright1 * 0.3
                        r = min(255, int(r + 212 * intensity))
                        g = min(255, int(g + 160 * intensity))
                        b = min(255, int(b + 67 * intensity))

                    if strand2_dist < glow_thickness:
                        intensity = (1 - strand2_dist / glow_thickness) ** 2 * bright2 * 0.3
                        r = min(255, int(r + 212 * intensity))
                        g = min(255, int(g + 160 * intensity))
                        b = min(255, int(b + 67 * intensity))

                    # Draw solid strands
                    if strand1_dist < thickness:
                        intensity = (1 - strand1_dist / thickness) * bright1
                        r = min(255, int(r * (1 - intensity) + 232 * intensity))
                        g = min(255, int(g * (1 - intensity) + 184 * intensity))
                        b = min(255, int(b * (1 - intensity) + 77 * intensity))

                    if strand2_dist < thickness:
                        intensity = (1 - strand2_dist / thickness) * bright2
                        r = min(255, int(r * (1 - intensity) + 200 * intensity))
                        g = min(255, int(g * (1 - intensity) + 150 * intensity))
                        b = min(255, int(b * (1 - intensity) + 55 * intensity))

                    # ─── Cross-links (rungs) between strands ───
                    # Draw rungs at regular intervals
                    rung_interval = 0.18
                    rung_pos = norm_y % rung_interval
                    if rung_pos < 0.03 or rung_pos > rung_interval - 0.03:
                        # Check if we're between the two strands
                        left_x = min(strand1_x, strand2_x)
                        right_x = max(strand1_x, strand2_x)
                        if left_x + thickness < x < right_x - thickness:
                            rung_fade = min(rung_pos, rung_interval - rung_pos) / 0.03
                            rung_fade = min(1, rung_fade)
                            # Thinner rungs
                            rung_y_center = round(norm_y / rung_interval) * rung_interval * (size * 0.7) + size * 0.15
                            rung_y_dist = abs(y - rung_y_center)
                            if rung_y_dist < size * 0.012:
                                rung_intensity = 0.4 * (1 - rung_y_dist / (size * 0.012))
                                r = min(255, int(r + 180 * rung_intensity))
                                g = min(255, int(g + 130 * rung_intensity))
                                b = min(255, int(b + 40 * rung_intensity))

                # ─── Sound wave arcs (left and right of helix) ───
                wave_cx = center
                wave_cy = center
                wave_dist = dist

                for i, wave_r in enumerate([size * 0.30, size * 0.35, size * 0.40]):
                    wave_width = size * 0.008
                    ring_dist = abs(wave_dist - wave_r)
                    if ring_dist < wave_width * 3:
                        # Only show arcs on left and right sides
                        angle = math.atan2(dy, dx)
                        # Left arc: around pi, Right arc: around 0
                        left_arc = abs(angle - math.pi) < 0.4 or abs(angle + math.pi) < 0.4
                        right_arc = abs(angle) < 0.4
                        if left_arc or right_arc:
                            arc_intensity = (1 - ring_dist / (wave_width * 3)) ** 2
                            arc_intensity *= (0.5 - i * 0.12)  # fade outer rings
                            r = min(255, int(r + 212 * arc_intensity))
                            g = min(255, int(g + 160 * arc_intensity))
                            b = min(255, int(b + 67 * arc_intensity))

            row.extend([r, g, b, a])
        img.append(bytes([0] + row))  # filter byte

    raw = b''.join(img)

    def chunk(ctype, data):
        c = ctype + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)

    ihdr = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)

    with open(path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n')
        f.write(chunk(b'IHDR', ihdr))
        f.write(chunk(b'IDAT', zlib.compress(raw, 9)))
        f.write(chunk(b'IEND', b''))


if __name__ == "__main__":
    out_dir = '/tmp/helix_icons'
    os.makedirs(out_dir, exist_ok=True)

    for s in [16, 32, 64, 128, 256, 512, 1024]:
        path = f'{out_dir}/icon_{s}x{s}.png'
        print(f'  Generating {s}x{s}...')
        create_helix_icon(s, path)

    print(f'\n  Icons saved to {out_dir}/')
