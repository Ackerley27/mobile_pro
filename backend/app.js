const express = require("express");
const session = require('express-session');
const app = express();
const { login, register } = require("./controllers/authController");
const { verifyToken, hasRole } = require('./middleware/authMiddleware');
const con = require("./config/db");

app.use(express.json());

app.use(session({
  cookie: { maxAge: 24 * 60 * 60 * 1000 }, // 1 วัน
  secret: 'mysecretcode',
  resave: false,
  saveUninitialized: true
}));


//------------------------setting routes-----------------------//
app.post('/register', register);
app.post('/login', login);
//------------------------setting routes-------------------------//


//------------------------------------------------------------------//
app.get('/assets', verifyToken, function (_req, res) {
  const sql = `
    SELECT 
        movies.id AS movie_id,
        movies.movie_name,
        movies.description,
        movies.status_movie,
        movies.pic,
        categories.categorie AS category_name
    FROM 
        movies 
    JOIN 
        categories ON movies.categorie = categories.cate_id;
  `;
  con.query(sql, function (err, results) {
    if (err) {
      console.error(err);
      return res.status(500).send('Server error');
    }
    res.json(results);
  });
});


//home//
app.get('/home', verifyToken,function (_req, res) {
  const sql = "SELECT * FROM categories";
  con.query(sql, function (err, results) {
    if (err) {
      console.error(err);
      return res.status(500).send('Server error');
    }
    res.json(results);
  });
});

//borrow
app.get('/borrow', function (_req, res) {
  const sql = `
    SELECT 
      m.id, 
      m.movie_name, 
      m.description, 
      c.categorie AS category_name, 
      m.pic 
    FROM 
      movies m
    JOIN 
      categories c ON m.categorie = c.cate_id
    JOIN 
      movie_status ms ON m.status_movie = ms.status_id
    WHERE 
      ms.status_name = 'available';
  `;

  con.query(sql, function (err, results) {
    if (err) {
      console.error(err);
      return res.status(500).send('Server error');
    }
    res.json(results);
  });
});

app.post('/:borrowerId/:movieId/borrow', verifyToken, hasRole('user'),(req, res) => {
  const { date_end } = req.body;
  const { borrowerId, movieId } = req.params; 
  const date_start = new Date().toISOString().split('T')[0];
  const sqlInsertBorrow = `INSERT INTO borrow (movie_id, borrower, date_start, date_end, status)
                           VALUES (?, ?, ?, ?, 2)`;
  const sqlUpdateMovieStatus = `UPDATE movies SET status_movie = 2 WHERE id = ?`;
  con.query(sqlInsertBorrow, [movieId, borrowerId, date_start, date_end, ], (err, result) => {
    if (err) {
      console.error("Error inserting borrow request:", err);
      return res.status(500).json({ error: "Database error" });
    }
    con.query(sqlUpdateMovieStatus, [movieId], (err) => {
      if (err) {
        console.error("Error updating movie status:", err);
        return res.status(500).json({ error: "Failed to update movie status" });
      }
      res.status(201).json({ message: "Borrow request created and movie status updated", borrowId: result.insertId });
    });
  });
});



//=======================Dashboard for admin==================================================
app.get('/admin/dashboard', verifyToken, hasRole('admin'),function (_req, res) {
  const sql = `
        SELECT 
            ms.status_name, 
            COUNT(m.id) AS total
        FROM 
            movie_status ms
        LEFT JOIN 
            movies m ON ms.status_id = m.status_movie
        GROUP BY 
            ms.status_id;
    `;

  con.query(sql, function (err, results) {
    if (err) {
      console.error(err);
      return res.status(500).send('Server error');
    }
    res.json(results);
  });
});

//=======================Dashboard for Approver  ==================================================
app.get('/approver/dashboard',verifyToken, hasRole('approver'), function (_req, res) {
  const sql = `
        SELECT 
            ms.status_name, 
            COUNT(m.id) AS total
        FROM 
            movie_status ms
        LEFT JOIN 
            movies m ON ms.status_id = m.status_movie
        GROUP BY 
            ms.status_id;
    `;

  con.query(sql, function (err, results) {
    if (err) {
      console.error(err);
      return res.status(500).send('Server error');
    }
    res.json(results);
  });
});



//=======================History Of user role  ==================================================
app.get('/user/:userId/history',verifyToken, hasRole('user'), function (req, res) {
  const userId = req.params.userId; // Get userId from request parameters

  // SQL query to get borrowing history for a specific user (borrower)
  const sql = `
      SELECT 
          movies.movie_name AS book_name,
          movies.id AS movie_ID,
          movies.pic AS movie_picture,
          borrow.date_start AS borrowed_date,
          borrow.date_end AS returned_date,
          returned_users.fullname AS returned_Named,
          approver_users.fullname AS approver_Named,
          status.status_name AS status
      FROM 
          borrow
      LEFT JOIN 
          movies ON borrow.movie_id = movies.id 
      LEFT JOIN 
          users AS approver_users ON borrow.approver = approver_users.id
      LEFT JOIN 
          users AS returned_users ON borrow.admin = returned_users.id
      LEFT JOIN 
          status ON borrow.status = status.id
      WHERE 
          borrow.borrower = ?;  -- Filter by the userId (borrower)
  `;

  con.query(sql, [userId], function (err, results) {
      if (err) {
          console.error("Error fetching borrowing history:", err);
          return res.status(500).send('Server error');
      }
      res.json(results);
  });
});






//=======================History Of Admin role  ==================================================
app.get('/admin/history', verifyToken, hasRole('admin'),function (req, res) {

  const sql = `
    SELECT 
    movies.movie_name AS book_name,
    movies.id AS movie_ID,
    movies.pic AS movie_picture,
    borrow.date_start AS borrowed_date,
    borrow.date_end AS returned_date,
    users.fullname AS borrower_Named,
    returned_users.fullname AS returned_Named,
    approver_users.fullname AS approver_Named,
    status.status_name AS status
FROM 
    borrow
LEFT JOIN 
    movies ON borrow.movie_id = movies.id
LEFT JOIN 
    users ON borrow.borrower = users.id
LEFT JOIN 
    users AS approver_users ON borrow.approver = approver_users.id
LEFT JOIN 
    users AS returned_users ON borrow.admin = returned_users.id
LEFT JOIN 
    status ON borrow.status = status.id;

  `;

  con.query(sql, function (err, results) {
    if (err) {
      console.error(err);
      return res.status(500).send('Server error');
    }
    res.json(results);
  });
});




//=======================History Of Approver role  ==================================================

app.get('/approver/:approverId/history',verifyToken, hasRole('approver'), function (req, res) {
  const approverId = req.params.approverId;  // ดึง approver_id จาก URL parameters

  const sql = 
    `
      SELECT 
          movies.movie_name AS book_name,
          movies.id AS movie_ID,
          movies.pic AS movie_picture,
          borrow.date_start AS borrowed_date,
          borrow.date_end AS returned_date,
          borrower_users.fullname AS borrower_Named,
          status.status_name AS status
      FROM 
          borrow
      LEFT JOIN 
          movies ON borrow.movie_id = movies.id 
      LEFT JOIN 
          users AS borrower_users ON borrow.borrower = borrower_users.id 
      LEFT JOIN 
          status ON borrow.status = status.id
      WHERE 
          borrow.approver = ?;  -- Filter by approverId
  `;
  con.query(sql, [approverId], function (err, results) {
    if (err) {
      console.error("Error fetching borrowing history:", err);
      return res.status(500).send('Server error');
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'No data found for the given approver ID' });
    }
    res.json(results);
  });
});




//=================================Edit movies===================================
app.put('/admin/assets/:movieID/edit',verifyToken, hasRole('admin'), function (req, res) {
  const movieId = req.params.movieID; // Get movieID from URL
  const { movie_name, description, categorie, status_movie, pic } = req.body;

  const sql = `
      UPDATE movies 
      SET 
          movie_name = ?, 
          description = ?, 
          categorie = (SELECT cate_id FROM categories WHERE cate_id = ?), 
          status_movie = (SELECT status_id FROM movie_status WHERE status_id = ?),
          pic = ? 
      WHERE 
          id = ?;
  `;

  // Execute the query
  con.query(sql, [movie_name, description, categorie, status_movie, pic, movieId], function (err, results) {
      if (err) {
          console.error('Database error:', err); // Log the detailed error
          return res.status(500).send("Server error: " + err.message); // Send detailed error message
      }
      if (results.affectedRows === 0) {
          return res.status(404).send("Movie not found or invalid category/status."); // Handle not found case
      }
      res.send("Movie updated successfully!"); // Success response
  });
});





 //============================== Add ==============
 app.post("/add", verifyToken, hasRole('admin'),function(req, res) {
  const { movie_name, description, categorie, status_movie, pic } = req.body;

  // Validate the input
  if (!movie_name || !description || !categorie || !pic) {
      return res.status(400).send("All fields are required.");
  }

  // SQL query to insert a new movie
  const sql = `INSERT INTO movies (movie_name, description, categorie, status_movie, pic) 
               VALUES (?, ?, ?, 1, ?)`;
  const roomValues = [movie_name, description, categorie, status_movie, pic];

  con.query(sql, roomValues, (err, result) => {
      if (err) {
          console.error('Error inserting movie:', err);
          return res.status(500).send('Error inserting movie into database');
      }

      // You can also retrieve the ID of the inserted movie
      const movieId = result.insertId;
      res.send(`Movie '${movie_name}' added successfully with ID: ${movieId}`);
  });
});

//return//
app.get('/admin/return',verifyToken, hasRole('admin'), function (req, res) {
  const sql = `
    SELECT 
      movies.movie_name AS movie_name,
      movies.id AS movie_id,
      borrow.date_start AS borrowed_date,
      borrow.date_end AS returned_date,
      returned_users.fullname AS borrower_name
    FROM 
      borrow
    LEFT JOIN 
      movies ON borrow.movie_id = movies.id
    LEFT JOIN 
      users AS returned_users ON borrow.borrower = returned_users.id
    WHERE 
      borrow.status = (SELECT id FROM status WHERE status_name = 'approved');
  `;

  con.query(sql, function (err, results) {
    if (err) {
      console.error(err);
      return res.status(500).send('Server error');
    }
    res.json(results);
  });
});

app.post('/admin/return/:borrowId',verifyToken, hasRole('admin'), function (req, res) {
  const { borrowId, adminId } = req.body;

  // Validate input
  if (!borrowId || !adminId) {
      return res.status(400).send('Borrow ID and Admin ID are required.');
  }

  const currentDate = new Date().toISOString().split('T')[0]; // Get today's date

  // SQL to update the borrow record to 'returned'
  const sqlUpdateBorrow = `
      UPDATE borrow 
      SET status = (SELECT id FROM status WHERE status_name = 'returned'), 
          date_end = ?,
          admin = ?
      WHERE id = ? AND status = (SELECT id FROM status WHERE status_name = 'approved');
  `;

  // SQL to update the movie status to 'available'
  const sqlUpdateMovieStatus = `
      UPDATE movies 
      SET status_movie = (SELECT status_id FROM movie_status WHERE status_name = 'available') 
      WHERE id = (SELECT movie_id FROM borrow WHERE id = ?);
  `;

  // Start transaction
  con.beginTransaction(function (err) {
      if (err) {
          console.error("Error starting transaction:", err);
          return res.status(500).send('Error starting transaction: ' + err.message);
      }

      // First, update the borrow status
      con.query(sqlUpdateBorrow, [currentDate, adminId, borrowId], function (err, result) {
          if (err) {
              return con.rollback(() => {
                  console.error("Error updating borrow status:", err);
                  return res.status(500).send('Error updating borrow status: ' + err.message);
              });
          }

          // Check if any rows were affected (meaning the update was successful)
          if (result.affectedRows === 0) {
              return con.rollback(() => {
                  return res.status(404).send('Borrow record not found or already returned.');
              });
          }

          // Then, update the movie status
          con.query(sqlUpdateMovieStatus, [borrowId], function (err) {
              if (err) {
                  return con.rollback(() => {
                      console.error("Error updating movie status:", err);
                      return res.status(500).send('Error updating movie status: ' + err.message);
                  });
              }

              // Commit the transaction
              con.commit(function (err) {
                  if (err) {
                      return con.rollback(() => {
                          console.error("Error committing transaction:", err);
                          return res.status(500).send('Error committing transaction: ' + err.message);
                      });
                  }
                  res.send('Movie returned successfully.'); // Success response
              });
          });
      });
  });
});


//confirm
app.get('/approver/confirm',verifyToken, hasRole('approver'), function (req, res) {
  const sql = `
    SELECT 
      movies.movie_name AS movie_name,
      movies.id AS movie_id,
      borrow.date_start AS borrowed_date,
      borrow.date_end AS returned_date,
      returned_users.fullname AS borrower_name
    FROM 
      borrow
    LEFT JOIN 
      movies ON borrow.movie_id = movies.id
    LEFT JOIN 
      users AS returned_users ON borrow.borrower = returned_users.id
    WHERE 
      borrow.status = (SELECT id FROM status WHERE status_name = 'pending');
  `;
  con.query(sql, function (err, results) {
    if (err) {
      console.error(err);
      return res.status(500).send('Server error');
    }
    res.json(results);
  });
});

app.post('/approver/confirm/:borrowId',verifyToken, hasRole('approver'), function (req, res) {
  const { approverId } = req.body || {}; // Only destructure approverId from the body
  const { borrowId } = req.params; // Get borrowId from request parameters

  // Check for missing fields
  if (!borrowId || !approverId) {
      return res.status(400).send('Missing borrowId or approverId in request.');
  }

  const sqlUpdateBorrow = `
      UPDATE borrow 
      SET 
          status = (SELECT id FROM status WHERE status_name = 'approved'), 
          approver = ? 
      WHERE id = ? 
      AND status = (SELECT id FROM status WHERE status_name = 'pending');
  `;

  const sqlUpdateMovieStatus = `
      UPDATE movies
      SET status_movie = (SELECT status_id FROM movie_status WHERE status_name = 'borrowed')
      WHERE id = (SELECT movie_id FROM borrow WHERE id = ?); 
  `;

  con.beginTransaction(function (err) {
      if (err) {
          console.error("Error starting transaction:", err);
          return res.status(500).send('Error starting transaction: ' + err.message);
      }

      // First, update the borrow status
      con.query(sqlUpdateBorrow, [approverId, borrowId], function (err, result) {
          if (err) {
              return con.rollback(() => {
                  console.error("Error updating borrow status:", err);
                  return res.status(500).send('Error updating borrow status: ' + err.message);
              });
          }

          // Check if any rows were affected
          if (result.affectedRows === 0) {
              return con.rollback(() => {
                  return res.status(404).send('Borrow record not found or not pending.');
              });
          }

          // Then, update the movie status
          con.query(sqlUpdateMovieStatus, [borrowId], function (err) {
              if (err) {
                  return con.rollback(() => {
                      console.error("Error updating movie status:", err);
                      return res.status(500).send('Error updating movie status: ' + err.message);
                  });
              }

              // Commit the transaction
              con.commit(function (err) {
                  if (err) {
                      return con.rollback(() => {
                          console.error("Error committing transaction:", err);
                          return res.status(500).send('Error committing transaction: ' + err.message);
                      });
                  }
                  res.send('Movie confirmed for borrowing successfully.'); // Update success message
              });
          });
      });
  });
});



//reject
app.post('/approver/reject/:borrowId',verifyToken, hasRole('approver'), function (req, res) {
  const { approverId } = req.body || {}; // Only destructure approverId from the body
  const { borrowId } = req.params; // Get borrowId from request parameters

  // Check for missing fields
  if (!borrowId || !approverId) {
      return res.status(400).send('Missing borrowId or approverId in request.');
  }

  const sqlUpdateBorrow = `
      UPDATE borrow 
      SET 
          status = (SELECT id FROM status WHERE status_name = 'rejected'), 
          approver = ? 
      WHERE id = ? 
      AND status = (SELECT id FROM status WHERE status_name = 'pending');
  `;

  const sqlUpdateMovieStatus = `
      UPDATE movies
      SET status_movie = (SELECT status_id FROM movie_status WHERE status_name = 'available')
      WHERE id = (SELECT movie_id FROM borrow WHERE id = ?); 
  `;

  con.beginTransaction(function (err) {
      if (err) {
          console.error("Error starting transaction:", err);
          return res.status(500).send('Error starting transaction: ' + err.message);
      }

      // First, update the borrow status
      con.query(sqlUpdateBorrow, [approverId, borrowId], function (err, result) {
          if (err) {
              return con.rollback(() => {
                  console.error("Error updating borrow status:", err);
                  return res.status(500).send('Error updating borrow status: ' + err.message);
              });
          }

          // Check if any rows were affected
          if (result.affectedRows === 0) {
              return con.rollback(() => {
                  return res.status(404).send('Borrow record not found or not pending.');
              });
          }

          // Then, update the movie status
          con.query(sqlUpdateMovieStatus, [borrowId], function (err) {
              if (err) {
                  return con.rollback(() => {
                      console.error("Error updating movie status:", err);
                      return res.status(500).send('Error updating movie status: ' + err.message);
                  });
              }

              // Commit the transaction
              con.commit(function (err) {
                  if (err) {
                      return con.rollback(() => {
                          console.error("Error committing transaction:", err);
                          return res.status(500).send('Error committing transaction: ' + err.message);
                      });
                  }
                  res.send('Movie rejected successfully.'); // Update success message
              });
          });
      });
  });
});



// ------------------- local port ห้ามแก้อันนี้ --------------------------------//
const port = 3000;
app.listen(port, function () {
  console.log("Server is ready at " + port);
});