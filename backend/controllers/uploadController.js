const Upload = require('../models/Upload');
const Rating = require('../models/Rating');
const Student = require('../models/Student');
const Notification = require('../models/Notification');

const notifyUploadOwner = async ({ recipientId, type, title, message, uploadId }) => {
  try {
    await Notification.create({
      recipientId,
      recipientType: 'Student',
      type,
      title,
      message,
      uploadId,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });
  } catch (error) {
    console.error(`Error creating ${type} notification:`, error);
  }
};

const createUpload = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'File is required' });

  const { subject, department, semester, title, tags = '', description = '' } = req.body;
  if (!subject || !department || !semester || !title) {
    return res.status(400).json({ message: 'subject, department, semester and title are required' });
  }

  const tagList = String(tags)
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  const upload = await Upload.create({
    studentId: req.student._id,
    subject: subject.trim(),
    department: department.trim(),
    semester: semester.trim(),
    title: title.trim(),
    tags: tagList,
    description: description.trim(),
    filePath: req.file.path,
  });

  // Increment student's upload count
  await Student.findByIdAndUpdate(req.student._id, { $inc: { uploadCount: 1 } });

  await notifyUploadOwner({
    recipientId: req.student._id,
    type: 'upload_created',
    title: 'Upload Successful',
    message: `Your file "${upload.title}" was uploaded successfully.`,
    uploadId: upload._id
  });

  res.status(201).json(upload);
};

const listUploads = async (req, res) => {
  const { subject, tags, title, department, semester, keywords, studentId, sort = 'rating', page = 1, limit = 20 } = req.query;
  const filter = { verified: true };

  // Subject filter (regex - case insensitive partial match)
  if (subject) {
    const trimmedSubject = subject.trim();
    if (trimmedSubject) {
      filter.subject = { $regex: trimmedSubject, $options: 'i' };
    }
  }

  // Title filter (regex - case insensitive partial match)
  if (title) {
    const trimmedTitle = title.trim();
    if (trimmedTitle) {
      filter.title = { $regex: trimmedTitle, $options: 'i' };
    }
  }

  // Department filter (exact match) - skip if empty
  if (department) {
    const trimmedDept = department.trim();
    if (trimmedDept) {
      filter.department = trimmedDept;
    }
  }

  // Semester filter (exact match) - skip if empty (allows "All Semesters")
  if (semester) {
    const trimmedSem = semester.trim();
    if (trimmedSem) {
      filter.semester = trimmedSem;
    }
  }

  // Student ID filter (exact match for uploaded by) - skip if empty
  if (studentId) {
    const trimmedStudentId = studentId.trim();
    if (trimmedStudentId) {
      filter.studentId = trimmedStudentId;
    }
  }

  // Tags filter
  if (tags) {
    const tagList = String(tags)
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (tagList.length) {
      filter.tags = { $in: tagList };
    }
  }

  // Keywords filter (searches in title, tags array, and description - case insensitive)
  if (keywords) {
    const keywordRegex = { $regex: keywords.trim(), $options: 'i' };
    filter.$or = [
      { title: keywordRegex },
      { tags: { $elemMatch: keywordRegex } }, // Properly match array elements
      { description: keywordRegex },
    ];
  }

  const sortOptions = {};
  if (sort === 'downloads') {
    sortOptions.downloads = -1;
    sortOptions.rating = -1;
  } else if (sort === 'recent') {
    sortOptions.createdAt = -1;
  } else {
    // default: sort by rating, then downloads, then newest
    sortOptions.rating = -1;
    sortOptions.downloads = -1;
  }
  sortOptions.createdAt = -1; // always secondary sorting for stability

  const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    Upload.find(filter).sort(sortOptions).skip(skip).limit(Number(limit)).lean(),
    Upload.countDocuments(filter),
  ]);

  // Attach uploader info (name + roll number)
  const studentIds = [...new Set(items.map((u) => String(u.studentId)))];
  const students = await Student.find({ _id: { $in: studentIds } }).lean();
  const studentMap = students.reduce((acc, s) => {
    acc[String(s._id)] = { name: s.name || '', rollNo: s.rollNo };
    return acc;
  }, {});

  const enriched = items.map((u) => {
    const uploader = studentMap[String(u.studentId)] || { name: 'Unknown', rollNo: '' };
    return {
      ...u,
      uploadedBy: uploader.name || uploader.rollNo || 'Unknown',
      uploadedByRoll: uploader.rollNo || '',
    };
  });

  res.json({ items: enriched, total, page: Number(page), limit: Number(limit) });
};

const downloadFile = async (req, res) => {
  const { id } = req.params;
  const upload = await Upload.findById(id);
  if (!upload) return res.status(404).json({ message: 'Upload not found' });

  upload.downloads += 1;
  await upload.save();

  res.download(upload.filePath, (err) => {
    if (err) {
      console.error('Download error', err);
      return;
    }
    if (String(upload.studentId) !== String(req.student._id)) {
      void notifyUploadOwner({
        recipientId: upload.studentId,
        type: 'upload_downloaded',
        title: 'Your File Was Downloaded',
        message: `Your file "${upload.title}" was downloaded.`,
        uploadId: upload._id
      });
    }
  });
};

const rateUpload = async (req, res) => {
  const { id } = req.params;
  let { rating } = req.body;
  rating = Number(rating);
  if (!id || !rating || rating < 1 || rating > 5) {
    return res.status(400).json({ message: 'Rating 1-5 is required' });
  }

  const upload = await Upload.findById(id);
  if (!upload) return res.status(404).json({ message: 'Upload not found' });

  const existing = await Rating.findOne({ uploadId: id, studentId: req.student._id });
  if (existing) {
    existing.rating = rating;
    await existing.save();
  } else {
    await Rating.create({ uploadId: id, studentId: req.student._id, rating });
  }

  // Recalculate average rating and ratings count
  const ratings = await Rating.find({ uploadId: id });
  const avg = ratings.length ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length : 0;

  upload.rating = Number(avg.toFixed(1));
  upload.averageRating = Number(avg.toFixed(1));
  upload.ratingsCount = ratings.length;
  await upload.save();

  if (String(upload.studentId) !== String(req.student._id)) {
    await notifyUploadOwner({
      recipientId: upload.studentId,
      type: 'upload_rated',
      title: 'Your File Received a Rating',
      message: `Your file "${upload.title}" received a ${rating}/5 rating.`,
      uploadId: upload._id
    });
  }

  res.json({
    message: 'Rating saved',
    rating: upload.averageRating,
    averageRating: upload.averageRating,
    ratingsCount: upload.ratingsCount,
  });
};

const getStudentDashboard = async (req, res) => {
  const studentId = req.student._id;

  // Stats for current student
  const uploads = await Upload.find({ studentId }).lean();
  const totalUploads = uploads.length;
  const totalDownloads = uploads.reduce((sum, u) => sum + (u.downloads || 0), 0);
  const avgRating = totalUploads > 0 ? uploads.reduce((sum, u) => sum + (u.rating || 0), 0) / totalUploads : 0;

  // Leaderboard: sort by uploads desc, then avgRating desc
  const leaderboard = await Upload.aggregate([
    {
      $group: {
        _id: '$studentId',
        uploads: { $sum: 1 },
        avgRating: { $avg: '$rating' },
      },
    },
    {
      $lookup: {
        from: 'students',
        localField: '_id',
        foreignField: '_id',
        as: 'student',
      },
    },
    { $unwind: '$student' },
    {
      $project: {
        studentId: '$_id',
        rollNo: '$student.rollNo',
        name: '$student.name',
        uploads: 1,
        avgRating: { $round: ['$avgRating', 1] },
      },
    },
    { $sort: { uploads: -1, avgRating: -1 } },
    { $limit: 10 },
  ]);

  const myRank = leaderboard.findIndex((s) => String(s.studentId) === String(studentId)) + 1;

  res.json({
    myStats: { uploads: totalUploads, downloads: totalDownloads, avgRating: Number(avgRating.toFixed(1)) },
    myRank,
    leaderboard,
  });
};

module.exports = { createUpload, listUploads, downloadFile, rateUpload, getStudentDashboard };
