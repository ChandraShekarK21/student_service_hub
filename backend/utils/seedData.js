const Product = require('../models/Product');

const seedProducts = async () => {
  await Product.deleteMany(); // 🔥 DELETE OLD DATA

  const samples = [
    {
      name: 'A4 Single Line Notebook',
      category: 'Notebooks',
      price: 25,
      stock: 90,
      minStock: 20,
      image: '/images/notebook.jpg'
    },
    {
      name: 'Ball Point Pen (Blue)',
      category: 'Pens',
      price: 8,
      stock: 190,
      minStock: 50,
      image: '/images/pen.jpg'
    },
    {
      name: 'Mechanical Pencil',
      category: 'Pencils',
      price: 35,
      stock: 120,
      minStock: 30,
      image: '/images/MechanicalPencil.jpg'
    },
    {
      name: 'Graph Paper Pad',
      category: 'Graph Books',
      price: 60,
      stock: 70,
      minStock: 20,
      image: '/images/GraphPaperPad.jpg'
    },
    {
      name: 'Plastic Geometry Box',
      category: 'Boxes',
      price: 130,
      stock: 55,
      minStock: 15,
      image: '/images/GeometryBox.jpg'
    },
    {
      name: 'File Folders (Pack)',
      category: 'Files',
      price: 120,
      stock: 80,
      minStock: 20,
      image: '/images/FileFolders.jpg'
    },
    {
      name: 'Physics Lab Manual',
      category: 'Lab Manuals',
      price: 180,
      stock: 40,
      minStock: 10,
      image: '/images/PhysicsLabManual.jpg'
    },
    {
      name: 'Drawing Sheets (Set)',
      category: 'Drawing Sheets',
      price: 95,
      stock: 65,
      minStock: 15,
      image: '/images/FileFolders.jpg'
    }
  ];

  await Product.insertMany(samples);
  console.log('✅ Seeded initial products with minimum stock levels');
};

module.exports = { seedProducts };
