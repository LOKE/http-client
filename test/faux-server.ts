import express from "express";

// Create an Express app
const app = express();
app.use(express.json()); // To parse JSON bodies

// Define mock endpoints
app.get("/users/:id", (req, res) => {
  const { id } = req.params;
  if (id === "123") {
    res.status(200).json({ id, name: "John Doe" });
  } else {
    res.status(404).json({ error: "User not found" });
  }
});

app.post("/users", (req, res) => {
  const { name, email } = req.body;
  if (name && email) {
    res.status(201).json({ id: "124", name, email });
  } else {
    res.status(400).json({ error: "Invalid data" });
  }
});

app.get("/metrics", (req, res) => {
  res.status(200).json({ success: true });
});

export default app;
