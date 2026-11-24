const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tsvqmdxjylxlveuklfcw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzdnFtZHhqeWx4bHZldWtsZmN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU0NTU3OTQsImV4cCI6MjExMTAzMTc5NH0.Qp_hKlUVawSrmBdRlEfkF17lnqfoaBd4Aa-FWWDdg2k';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false
  },
  realtime: {
    transport: WebSocket
  }
});

/**
 * Uploads a PDF resume to Supabase Storage bucket 'resumes'
 */
async function uploadResumeToSupabase(fileName, filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const fileBuffer = fs.readFileSync(filePath);

    const { data, error } = await supabase.storage
      .from('resumes')
      .upload(fileName, fileBuffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (error) {
      console.error('Supabase Storage upload warning:', error.message);
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from('resumes')
      .getPublicUrl(fileName);

    return publicUrlData ? publicUrlData.publicUrl : null;
  } catch (err) {
    console.error('Failed to upload resume to Supabase Storage:', err);
    return null;
  }
}

module.exports = {
  supabase,
  SUPABASE_URL,
  SUPABASE_KEY,
  uploadResumeToSupabase
};
