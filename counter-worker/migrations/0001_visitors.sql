CREATE TABLE visitors (
  visitor_hash TEXT PRIMARY KEY,
  first_seen_day TEXT NOT NULL,
  last_seen_day TEXT NOT NULL
);

CREATE INDEX visitors_last_seen_day_idx ON visitors(last_seen_day);
