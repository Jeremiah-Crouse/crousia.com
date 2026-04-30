import express from 'express';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

const router = express.Router();
const ARCHIVES_DIR = '/Users/jeremiahcrouse/crousia-v2/archives';

/**
 * GET /archives
 * Returns a list of available archive dates for bots to discover.
 */
router.get('/archives', async (req, res) => {
    try {
        const today = new Date().toLocaleDateString('en-CA');
        const files = await fsp.readdir(ARCHIVES_DIR);
        const dates = files
            .filter(file => file.endsWith('.json') && file !== `${today}.json`)
            .map(file => path.parse(file).name)
            .sort()
            .reverse();
        
        res.json({ archives: dates });
    } catch (error) {
        res.status(500).json({ error: 'Failed to read archives' });
    }
});

/**
 * GET /archive/:date
 * Serves the JSON content of a specific archive.
 */
router.get('/archive/:date', (req, res) => {
    const { date } = req.params;

    // Security: Validate the date format to prevent directory traversal attacks
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
    }

    const filePath = path.join(ARCHIVES_DIR, `${date}.json`);

    fs.access(filePath, fs.constants.R_OK, (err) => {
        if (err) {
            return res.status(404).json({ error: 'Archive not found' });
        }

        // Serve the file using a ReadStream for memory efficiency
        res.setHeader('Content-Type', 'application/json');
        const readStream = fs.createReadStream(filePath);
        readStream.pipe(res);
    });
});

export default router;