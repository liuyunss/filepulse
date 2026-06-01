// test.js - 测试数据生成器
// 用于在浏览器控制台运行，模拟文件选择效果

function createMockFiles() {
    return [
        {
            name: '视频.mp4',
            size: 1500000000, // 1.5 GB
            lastModified: new Date('2025-11-01'),
            webkitRelativePath: '测试文件夹/视频/视频.mp4',
            type: 'mp4'
        },
        {
            name: '笔记.txt',
            size: 2048, // 2 KB
            lastModified: new Date('2025-11-15'),
            webkitRelativePath: '测试文件夹/文档/笔记.txt',
            type: 'txt'
        },
        {
            name: '图片.jpg',
            size: 5242880, // 5 MB
            lastModified: new Date('2025-10-20'),
            webkitRelativePath: '测试文件夹/图片/图片.jpg',
            type: 'jpg'
        },
        {
            name: '空子文件夹.txt',
            size: 0,
            lastModified: new Date('2025-11-10'),
            webkitRelativePath: '测试文件夹/文档/子文件夹/空子文件夹.txt',
            type: 'txt'
        },
        {
            name: '电影.avi',
            size: 3221225472, // 3 GB
            lastModified: new Date('2025-11-05'),
            webkitRelativePath: '测试文件夹/视频/电影.avi',
            type: 'avi'
        }
    ];
}

// 将 mock 文件转换为 File 对象数组
function mockToFiles() {
    return createMockFiles().map(f => {
        const blob = new Blob([f.name], { type: 'text/plain' });
        const file = new File([blob], f.name, {
            lastModified: f.lastModified,
            type: ''
        });
        // Monkey-patch webkitRelativePath
        Object.defineProperty(file, 'webkitRelativePath', {
            value: f.webkitRelativePath,
            writable: false,
            enumerable: true,
            configurable: true
        });
        return file;
    });
}

// 在控制台运行: scanFolder(mockToFiles()) 即可测试
