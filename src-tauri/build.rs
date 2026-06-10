use std::fs;
use std::path::Path;

fn main() {
    let icons_dir = Path::new("icons");
    if !icons_dir.exists() {
        fs::create_dir_all(icons_dir).expect("Failed to create icons directory");
    }

    create_valid_png("icons/32x32.png", 32, 32);
    create_valid_png("icons/128x128.png", 128, 128);
    create_valid_png("icons/128x128@2x.png", 128, 128);
    create_ico_from_png("icons/icon.ico", "icons/32x32.png");
    create_valid_png("icons/icon.png", 32, 32);

    if !Path::new("icons/icon.icns").exists() {
        fs::write("icons/icon.icns", b"icnsplaceholder").ok();
    }

    println!("Icons ready!");
    tauri_build::build();
}

fn create_valid_png(path: &str, width: u32, height: u32) {
    if Path::new(path).exists() { return; }
    let mut data = Vec::new();
    data.extend_from_slice(&[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    let ihdr = create_ihdr(width, height);
    write_chunk(&mut data, b"IHDR", &ihdr);
    let idat = create_idat(width, height);
    write_chunk(&mut data, b"IDAT", &idat);
    write_chunk(&mut data, b"IEND", &[]);
    fs::write(path, data).expect("Failed to write PNG");
    println!("Created: {}", path);
}

fn create_ihdr(width: u32, height: u32) -> Vec<u8> {
    let mut d = Vec::new();
    d.extend_from_slice(&width.to_be_bytes());
    d.extend_from_slice(&height.to_be_bytes());
    d.extend_from_slice(&[8, 2, 0, 0, 0]);
    d
}

fn create_idat(width: u32, height: u32) -> Vec<u8> {
    let mut raw = Vec::new();
    for _ in 0..height {
        raw.push(0); // filter: None
        for _ in 0..width {
            raw.push(0x18); // R
            raw.push(0x90); // G
            raw.push(0xFF); // B = #1890FF blue
        }
    }
    deflate_compress(&raw)
}

fn deflate_compress(input: &[u8]) -> Vec<u8> {
    let mut out = vec![0x78, 0x01]; // zlib header
    let len = input.len() as u16;
    out.push(0x01); // BFINAL=1, BTYPE=00 (uncompressed)
    out.extend_from_slice(&len.to_le_bytes());
    out.extend_from_slice(&(!len).to_le_bytes());
    out.extend_from_slice(input);
    let adler = adler32(input);
    out.extend_from_slice(&adler.to_be_bytes());
    out
}

fn adler32(data: &[u8]) -> u32 {
    let mut a: u32 = 1;
    let mut b: u32 = 0;
    for &byte in data {
        a = (a + byte as u32) % 65521;
        b = (b + a) % 65521;
    }
    (b << 16) | a
}

fn write_chunk(data: &mut Vec<u8>, ctype: &[u8; 4], cdata: &[u8]) {
    data.extend_from_slice(&(cdata.len() as u32).to_be_bytes());
    let start = data.len();
    data.extend_from_slice(ctype);
    data.extend_from_slice(cdata);
    let crc = crc32(&data[start..]);
    data.extend_from_slice(&crc.to_be_bytes());
}

fn crc32(data: &[u8]) -> u32 {
    let mut crc: u32 = 0xFFFFFFFF;
    for &byte in data {
        crc ^= byte as u32;
        for _ in 0..8 {
            crc = if crc & 1 == 1 { (crc >> 1) ^ 0xEDB88320 } else { crc >> 1 };
        }
    }
    !crc
}

fn create_ico_from_png(ico_path: &str, png_path: &str) {
    if Path::new(ico_path).exists() { return; }
    let png_data = fs::read(png_path).expect("Failed to read PNG");
    let mut ico = Vec::new();
    ico.extend_from_slice(&[0x00, 0x00, 0x01, 0x00, 0x01, 0x00]);
    ico.push(32); ico.push(32);
    ico.push(0); ico.push(0);
    ico.extend_from_slice(&[0x01, 0x00, 0x20, 0x00]);
    let size: u32 = png_data.len() as u32;
    let offset: u32 = 22;
    ico.extend_from_slice(&size.to_le_bytes());
    ico.extend_from_slice(&offset.to_le_bytes());
    ico.extend_from_slice(&png_data);
    fs::write(ico_path, ico).expect("Failed to write ICO");
    println!("Created: {}", ico_path);
}
