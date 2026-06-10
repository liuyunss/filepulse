use serde::Serialize;
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize)]
pub struct RotateResult {
    pub path: String,
    pub original_orientation: u16,
    pub new_orientation: u16,
    pub description: String,
}

#[tauri::command]
pub fn rotate_file(path: String, angle: u16, direction: String) -> Result<RotateResult, String> {
    let path = Path::new(&path);
    if !path.exists() {
        return Err("File not found".into());
    }

    let data = fs::read(path).map_err(|e| format!("Read error: {}", e))?;

    if data.len() < 2 || data[0] != 0xFF || data[1] != 0xD8 {
        return Err("Not a valid JPEG file".into());
    }

    // Find EXIF APP1 marker
    let exif_offset = find_exif_app1(&data).ok_or("No EXIF data found in this image")?;

    // Parse orientation
    let old_orientation = read_orientation(&data, exif_offset).unwrap_or(1);

    // Calculate new orientation
    let new_orientation = calc_orientation(old_orientation, angle, &direction);

    // Write new orientation
    let mut new_data = data.clone();
    write_orientation(&mut new_data, exif_offset, new_orientation)
        .map_err(|e| format!("Write EXIF error: {}", e))?;

    fs::write(path, &new_data).map_err(|e| format!("Write file error: {}", e))?;

    let desc = format!(
        "{}° {} → 方向 {}",
        angle,
        if direction == "cw" { "顺时针" } else { "逆时针" },
        orientation_name(new_orientation)
    );

    Ok(RotateResult {
        path: path.display().to_string(),
        original_orientation: old_orientation,
        new_orientation,
        description: desc,
    })
}

#[tauri::command]
pub fn preview_rotate(path: String, angle: u16, direction: String) -> Result<RotateResult, String> {
    let path = Path::new(&path);
    if !path.exists() {
        return Err("File not found".into());
    }

    let data = fs::read(path).map_err(|e| format!("Read error: {}", e))?;
    let exif_offset = find_exif_app1(&data).ok_or("No EXIF data found")?;
    let old_orientation = read_orientation(&data, exif_offset).unwrap_or(1);
    let new_orientation = calc_orientation(old_orientation, angle, &direction);

    let desc = format!(
        "当前方向: {} → {}° {}后: {}",
        orientation_name(old_orientation),
        angle,
        if direction == "cw" { "顺时针" } else { "逆时针" },
        orientation_name(new_orientation)
    );

    Ok(RotateResult {
        path: path.display().to_string(),
        original_orientation: old_orientation,
        new_orientation,
        description: desc,
    })
}

fn find_exif_app1(data: &[u8]) -> Option<usize> {
    let mut pos = 2; // Skip SOI
    while pos + 4 <= data.len() {
        if data[pos] != 0xFF {
            return None;
        }
        let marker = data[pos + 1];
        if marker == 0xE1 {
            // APP1 - check for "Exif"
            if pos + 10 <= data.len() && &data[pos + 4..pos + 10] == b"Exif\0\0" {
                return Some(pos);
            }
        }
        if marker == 0xDA || marker == 0xD9 {
            break; // SOS or EOI
        }
        if pos + 2 >= data.len() {
            break;
        }
        let len = ((data[pos + 2] as usize) << 8) | (data[pos + 3] as usize);
        pos += 2 + len;
    }
    None
}

fn read_orientation(data: &[u8], app1_offset: usize) -> Option<u16> {
    // Skip APP1 marker (2) + length (2) + "Exif\0\0" (6) = 10 bytes to TIFF header
    let tiff_start = app1_offset + 10;
    if tiff_start + 8 > data.len() {
        return None;
    }

    let big_endian = data[tiff_start..tiff_start + 2] == [0x4D, 0x4D]; // MM = big endian
    let read_u16 = |pos: usize| -> u16 {
        if big_endian {
            ((data[pos] as u16) << 8) | (data[pos + 1] as u16)
        } else {
            ((data[pos + 1] as u16) << 8) | (data[pos] as u16)
        }
    };
    let read_u32 = |pos: usize| -> u32 {
        if big_endian {
            ((data[pos] as u32) << 24) | ((data[pos + 1] as u32) << 16) | ((data[pos + 2] as u32) << 8) | (data[pos + 3] as u32)
        } else {
            ((data[pos + 3] as u32) << 24) | ((data[pos + 2] as u32) << 16) | ((data[pos + 1] as u32) << 8) | (data[pos] as u32)
        }
    };

    // Verify TIFF magic
    if read_u16(tiff_start + 2) != 0x002A {
        return None;
    }

    let ifd_offset = read_u32(tiff_start + 4) as usize;
    let ifd_start = tiff_start + ifd_offset;
    if ifd_start + 2 > data.len() {
        return None;
    }

    let entry_count = read_u16(ifd_start) as usize;
    let mut pos = ifd_start + 2;

    for _ in 0..entry_count {
        if pos + 12 > data.len() {
            break;
        }
        let tag = read_u16(pos);
        let tag_type = read_u16(pos + 2);
        let count = read_u32(pos + 4) as usize;

        if tag == 0x0112 {
            // Orientation tag
            if tag_type == 3 {
                // SHORT (2 bytes)
                return Some(read_u16(pos + 8));
            }
        }
        pos += 12;
    }

    None
}

fn write_orientation(data: &mut [u8], app1_offset: usize, new_value: u16) -> Result<(), String> {
    let tiff_start = app1_offset + 10;
    if tiff_start + 8 > data.len() {
        return Err("TIFF header too short".into());
    }

    let big_endian = data[tiff_start..tiff_start + 2] == [0x4D, 0x4D];

    let write_u16 = |d: &mut [u8], pos: usize, v: u16| {
        if big_endian {
            d[pos] = (v >> 8) as u8;
            d[pos + 1] = v as u8;
        } else {
            d[pos] = v as u8;
            d[pos + 1] = (v >> 8) as u8;
        }
    };
    let read_u16 = |d: &[u8], pos: usize| -> u16 {
        if big_endian {
            ((d[pos] as u16) << 8) | (d[pos + 1] as u16)
        } else {
            ((d[pos + 1] as u16) << 8) | (d[pos] as u16)
        }
    };
    let read_u32 = |d: &[u8], pos: usize| -> u32 {
        if big_endian {
            ((d[pos] as u32) << 24) | ((d[pos + 1] as u32) << 16) | ((d[pos + 2] as u32) << 8) | (d[pos + 3] as u32)
        } else {
            ((d[pos + 3] as u32) << 24) | ((d[pos + 2] as u32) << 16) | ((d[pos + 1] as u32) << 8) | (d[pos] as u32)
        }
    };

    let ifd_offset = read_u32(data, tiff_start + 4) as usize;
    let ifd_start = tiff_start + ifd_offset;
    let entry_count = read_u16(data, ifd_start) as usize;
    let mut pos = ifd_start + 2;

    for _ in 0..entry_count {
        let tag = read_u16(data, pos);
        if tag == 0x0112 {
            write_u16(data, pos + 8, new_value);
            return Ok(());
        }
        pos += 12;
    }

    Err("Orientation tag not found".into())
}

fn calc_orientation(current: u16, angle: u16, direction: &str) -> u16 {
    let steps = (angle / 90) % 4;
    if steps == 0 {
        return current;
    }
    // Correct EXIF orientation composition for 90° rotations
    // index = current orientation (1-8), value = result after one step
    let cw_map  = [0, 6, 7, 8, 5, 2, 3, 4, 1]; // 90° CW
    let ccw_map = [0, 8, 5, 6, 7, 4, 1, 2, 3]; // 90° CCW

    let mut o = current;
    for _ in 0..steps {
        let idx = o as usize;
        o = if direction == "cw" {
            if idx < cw_map.len() { cw_map[idx] } else { 1 }
        } else {
            if idx < ccw_map.len() { ccw_map[idx] } else { 1 }
        };
    }
    if o == 0 { o = 1; }
    o
}

fn orientation_name(v: u16) -> &'static str {
    match v {
        1 => "正常",
        2 => "水平翻转",
        3 => "180°",
        4 => "垂直翻转",
        5 => "顺时针90°+翻转",
        6 => "顺时针90°",
        7 => "逆时针90°+翻转",
        8 => "逆时针90°",
        _ => "未知",
    }
}
