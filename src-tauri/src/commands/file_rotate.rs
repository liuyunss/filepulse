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

    // JPEG
    if data.len() >= 2 && data[0] == 0xFF && data[1] == 0xD8 {
        return rotate_jpeg(path, &data, angle, &direction);
    }
    // MP4/MOV (starts with ftyp atom: 4 bytes size + 'ftyp')
    if data.len() >= 12 && &data[4..8] == b"ftyp" {
        return rotate_mp4(path, &data, angle, &direction);
    }

    Err("Unsupported format (only JPEG and MP4/MOV)".into())
}

#[tauri::command]
pub fn preview_rotate(path: String, angle: u16, direction: String) -> Result<RotateResult, String> {
    let path = Path::new(&path);
    if !path.exists() {
        return Err("File not found".into());
    }
    let data = fs::read(path).map_err(|e| format!("Read error: {}", e))?;
    let ext = path.extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default();

    if data.len() >= 2 && data[0] == 0xFF && data[1] == 0xD8 {
        let old_ori = find_exif_app1(&data)
            .and_then(|off| read_orientation(&data, off))
            .unwrap_or(1);
        let new_ori = calc_orientation(old_ori, angle, &direction);
        let desc = format!("{}°{}: {} → {}", angle, if direction == "cw" { "顺" } else { "逆" }, orientation_name(old_ori), orientation_name(new_ori));
        return Ok(RotateResult { path: path.display().to_string(), original_orientation: old_ori, new_orientation: new_ori, description: desc });
    }
    if &ext == "mp4" || &ext == "mov" {
        let old_ori = read_mp4_rotation(&data).unwrap_or(1);
        let new_ori = calc_orientation(old_ori, angle, &direction);
        let desc = format!("{}°{}: {} → {}", angle, if direction == "cw" { "顺" } else { "逆" }, orientation_name(old_ori), orientation_name(new_ori));
        return Ok(RotateResult { path: path.display().to_string(), original_orientation: old_ori, new_orientation: new_ori, description: desc });
    }

    Err("Unsupported format".into())
}

// ── JPEG ──

fn rotate_jpeg(path: &Path, data: &[u8], angle: u16, direction: &str) -> Result<RotateResult, String> {
    let exif_offset = find_exif_app1(data).ok_or("No EXIF data found")?;
    let old_orientation = read_orientation(data, exif_offset).unwrap_or(1);
    let new_orientation = calc_orientation(old_orientation, angle, direction);
    let mut new_data = data.to_vec();
    write_orientation(&mut new_data, exif_offset, new_orientation)
        .map_err(|e| format!("Write EXIF error: {}", e))?;
    fs::write(path, &new_data).map_err(|e| format!("Write file error: {}", e))?;
    Ok(RotateResult {
        path: path.display().to_string(),
        original_orientation: old_orientation,
        new_orientation,
        description: format!("{}°{}: {} → {}", angle, if direction == "cw" { "顺" } else { "逆" }, orientation_name(old_orientation), orientation_name(new_orientation)),
    })
}

// ── MP4 ──

fn rotate_mp4(path: &Path, data: &[u8], angle: u16, direction: &str) -> Result<RotateResult, String> {
    let old_orientation = read_mp4_rotation(data).unwrap_or(1);
    let new_orientation = calc_orientation(old_orientation, angle, direction);
    let mut new_data = data.to_vec();
    write_mp4_rotation(&mut new_data, new_orientation)?;
    fs::write(path, &new_data).map_err(|e| format!("Write file error: {}", e))?;
    Ok(RotateResult {
        path: path.display().to_string(),
        original_orientation: old_orientation,
        new_orientation,
        description: format!("{}°{}: {} → {}", angle, if direction == "cw" { "顺" } else { "逆" }, orientation_name(old_orientation), orientation_name(new_orientation)),
    })
}

fn read_mp4_rotation(data: &[u8]) -> Option<u16> {
    let tkhd_offset = find_tkhd(data)?;
    let matrix = read_matrix(data, tkhd_offset);
    matrix_to_orientation(matrix)
}

fn write_mp4_rotation(data: &mut [u8], orientation: u16) -> Result<(), String> {
    let tkhd_offset = find_tkhd(data).ok_or("tkhd atom not found")?;
    let matrix = orientation_to_matrix(orientation);
    // tkhd offset: 4 bytes size + 4 bytes 'tkhd' + 1 version + 3 flags = 8
    // matrix starts at offset 40 (version 0) or 52 (version 1) from tkhd start
    let version = data[tkhd_offset + 8];
    let matrix_offset = tkhd_offset + if version == 0 { 40 } else { 52 };
    write_matrix(data, matrix_offset, &matrix);
    Ok(())
}

/// Find 'moov' → 'trak' → 'tkhd' atom. Returns offset to the start of 'tkhd'.
fn find_tkhd(data: &[u8]) -> Option<usize> {
    let moov = find_atom(data, 0, b"moov")?;
    let trak = find_atom(data, moov + 8, b"trak")?;
    find_atom(data, trak + 8, b"tkhd")
}

fn find_atom(data: &[u8], start: usize, name: &[u8; 4]) -> Option<usize> {
    let mut pos = start;
    while pos + 8 <= data.len() {
        let size = u32::from_be_bytes([data[pos], data[pos+1], data[pos+2], data[pos+3]]) as usize;
        if size < 8 || pos + size > data.len() {
            break;
        }
        if &data[pos + 4..pos + 8] == name {
            return Some(pos);
        }
        if size == 1 {
            // 64-bit extended size
            pos += 16; // skip 8 bytes header + 8 bytes extended size
        } else {
            pos += size;
        }
    }
    None
}

/// Read 3×3 transformation matrix bytes at offset. Returns [a,b,u, c,d,v, x,y,w] as f64.
fn read_matrix(data: &[u8], tkhd_start: usize) -> [f64; 9] {
    let version = data[tkhd_start + 8];
    let base = tkhd_start + if version == 0 { 40 } else { 52 };
    let mut m = [0.0f64; 9];
    for i in 0..9 {
        let off = base + i * 4;
        if off + 4 <= data.len() {
            let v = i32::from_be_bytes([data[off], data[off+1], data[off+2], data[off+3]]);
            m[i] = v as f64 / 65536.0; // 16.16 fixed-point
        }
    }
    m
}

fn write_matrix(data: &mut [u8], offset: usize, matrix: &[f64; 9]) {
    for i in 0..9 {
        let v = (matrix[i] * 65536.0) as i32;
        let bytes = v.to_be_bytes();
        let off = offset + i * 4;
        if off + 4 <= data.len() {
            data[off..off+4].copy_from_slice(&bytes);
        }
    }
}

/// Convert MP4 transformation matrix to EXIF-style orientation (1-8).
/// Standard identity: [1,0,0, 0,1,0, 0,0,1]
fn matrix_to_orientation(m: [f64; 9]) -> Option<u16> {
    let (a, b, _u, c, d, _v, _x, _y, _w) = (m[0], m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8]);
    // Round to nearest integer for comparison (16.16 fixed has some precision loss)
    let ra = a.round() as i32;
    let rb = b.round() as i32;
    let rc = c.round() as i32;
    let rd = d.round() as i32;
    match (ra, rb, rc, rd) {
        (1,  0,  0,  1) => Some(1), // identity
        (-1, 0,  0,  1) => Some(2), // flip H
        (-1, 0,  0, -1) => Some(3), // 180°
        (1,  0,  0, -1) => Some(4), // flip V
        (0,  1,  1,  0) => Some(5), // transpose
        (0,  1, -1,  0) => Some(6), // 90° CW
        (0, -1, -1,  0) => Some(7), // anti-transpose
        (0, -1,  1,  0) => Some(8), // 90° CCW
        _ => Some(1), // unknown → assume normal
    }
}

fn orientation_to_matrix(ori: u16) -> [f64; 9] {
    // 16.16 fixed-point representation
    match ori {
        1 => [ 1.0,  0.0, 0.0,  0.0,  1.0, 0.0, 0.0, 0.0, 1.0],
        2 => [-1.0,  0.0, 0.0,  0.0,  1.0, 0.0, 0.0, 0.0, 1.0],
        3 => [-1.0,  0.0, 0.0,  0.0, -1.0, 0.0, 0.0, 0.0, 1.0],
        4 => [ 1.0,  0.0, 0.0,  0.0, -1.0, 0.0, 0.0, 0.0, 1.0],
        5 => [ 0.0,  1.0, 0.0,  1.0,  0.0, 0.0, 0.0, 0.0, 1.0],
        6 => [ 0.0,  1.0, 0.0, -1.0,  0.0, 0.0, 0.0, 0.0, 1.0],
        7 => [ 0.0, -1.0, 0.0, -1.0,  0.0, 0.0, 0.0, 0.0, 1.0],
        8 => [ 0.0, -1.0, 0.0,  1.0,  0.0, 0.0, 0.0, 0.0, 1.0],
        _ => [ 1.0,  0.0, 0.0,  0.0,  1.0, 0.0, 0.0, 0.0, 1.0],
    }
}

// ── JPEG EXIF ──

fn find_exif_app1(data: &[u8]) -> Option<usize> {
    let mut pos = 2;
    while pos + 4 <= data.len() {
        if data[pos] != 0xFF { return None; }
        let marker = data[pos + 1];
        if marker == 0xE1 {
            if pos + 10 <= data.len() && &data[pos + 4..pos + 10] == b"Exif\0\0" {
                return Some(pos);
            }
        }
        if marker == 0xDA || marker == 0xD9 { break; }
        if pos + 2 >= data.len() { break; }
        let len = ((data[pos + 2] as usize) << 8) | (data[pos + 3] as usize);
        pos += 2 + len;
    }
    None
}

fn read_orientation(data: &[u8], app1_offset: usize) -> Option<u16> {
    let tiff_start = app1_offset + 10;
    if tiff_start + 8 > data.len() { return None; }
    let big_endian = data[tiff_start..tiff_start + 2] == [0x4D, 0x4D];
    let read_u16 = |pos: usize| -> u16 {
        if big_endian { ((data[pos] as u16) << 8) | (data[pos + 1] as u16) }
        else { ((data[pos + 1] as u16) << 8) | (data[pos] as u16) }
    };
    let read_u32 = |pos: usize| -> u32 {
        if big_endian {
            ((data[pos] as u32) << 24) | ((data[pos + 1] as u32) << 16) | ((data[pos + 2] as u32) << 8) | (data[pos + 3] as u32)
        } else {
            ((data[pos + 3] as u32) << 24) | ((data[pos + 2] as u32) << 16) | ((data[pos + 1] as u32) << 8) | (data[pos] as u32)
        }
    };
    if read_u16(tiff_start + 2) != 0x002A { return None; }
    let ifd_offset = read_u32(tiff_start + 4) as usize;
    let ifd_start = tiff_start + ifd_offset;
    if ifd_start + 2 > data.len() { return None; }
    let entry_count = read_u16(ifd_start) as usize;
    let mut pos = ifd_start + 2;
    for _ in 0..entry_count {
        if pos + 12 > data.len() { break; }
        if read_u16(pos) == 0x0112 && read_u16(pos + 2) == 3 {
            return Some(read_u16(pos + 8));
        }
        pos += 12;
    }
    None
}

fn write_orientation(data: &mut [u8], app1_offset: usize, new_value: u16) -> Result<(), String> {
    let tiff_start = app1_offset + 10;
    if tiff_start + 8 > data.len() { return Err("TIFF header too short".into()); }
    let big_endian = data[tiff_start..tiff_start + 2] == [0x4D, 0x4D];
    let write_u16 = |d: &mut [u8], pos: usize, v: u16| {
        if big_endian { d[pos] = (v >> 8) as u8; d[pos + 1] = v as u8; }
        else { d[pos] = v as u8; d[pos + 1] = (v >> 8) as u8; }
    };
    let read_u16 = |d: &[u8], pos: usize| -> u16 {
        if big_endian { ((d[pos] as u16) << 8) | (d[pos + 1] as u16) }
        else { ((d[pos + 1] as u16) << 8) | (d[pos] as u16) }
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
        if read_u16(data, pos) == 0x0112 {
            write_u16(data, pos + 8, new_value);
            return Ok(());
        }
        pos += 12;
    }
    Err("Orientation tag not found".into())
}

fn calc_orientation(current: u16, angle: u16, direction: &str) -> u16 {
    let steps = (angle / 90) % 4;
    if steps == 0 { return current; }
    let cw_map  = [0, 6, 7, 8, 5, 2, 3, 4, 1];
    let ccw_map = [0, 8, 5, 6, 7, 4, 1, 2, 3];
    let mut o = current;
    for _ in 0..steps {
        let idx = o as usize;
        o = if direction == "cw" { cw_map.get(idx).copied().unwrap_or(1) }
            else { ccw_map.get(idx).copied().unwrap_or(1) };
    }
    if o == 0 { 1 } else { o }
}

fn orientation_name(v: u16) -> &'static str {
    match v {
        1 => "正常", 2 => "水平翻转", 3 => "180°", 4 => "垂直翻转",
        5 => "顺时针90°+翻转", 6 => "顺时针90°", 7 => "逆时针90°+翻转", 8 => "逆时针90°",
        _ => "未知",
    }
}
