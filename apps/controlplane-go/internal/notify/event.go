package notify

import (
	"encoding/json"
	"errors"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"go.mongodb.org/mongo-driver/v2/bson"
)

var ErrInvalid = errors.New("invalid notification event")
var objectID = regexp.MustCompile(`^[0-9a-f]{24}$`)

type Document struct {
	ID        string `bson:"_id" json:"-"`
	EventID   string `bson:"event_id" json:"event_id"`
	EventType string `bson:"event_type" json:"event_type"`
	User      string `bson:"user" json:"user"`
	ReportID  string `bson:"report_id" json:"report_id"`
	ScanID    string `bson:"scan_id" json:"scan_id"`
	Message   string `bson:"message" json:"message"`
	Timestamp string `bson:"timestamp" json:"timestamp"`
}

func bounded(value string, max int) bool {
	return strings.TrimSpace(value) != "" && utf8.RuneCountInString(value) <= max
}
func Parse(body []byte) (Document, error) {
	var raw map[string]json.RawMessage
	if len(body) > 65536 || json.Unmarshal(body, &raw) != nil || raw == nil {
		return Document{}, ErrInvalid
	}
	var event struct {
		Version json.Number `json:"schema_version"`
		ID      string      `json:"event_id"`
		Kind    string      `json:"event_type"`
		User    string      `json:"user_id"`
		Time    string      `json:"occurred_at"`
		Data    *struct {
			Report  string `json:"report_id"`
			Scan    string `json:"scan_id"`
			Message string `json:"message"`
		} `json:"data"`
	}
	if _, versioned := raw["schema_version"]; !versioned {
		var legacy struct {
			Report  string `json:"reportId"`
			Scan    string `json:"scanId"`
			User    string `json:"user"`
			Message string `json:"message"`
		}
		if json.Unmarshal(body, &legacy) != nil || !objectID.MatchString(legacy.Report) {
			return Document{}, ErrInvalid
		}
		id, _ := bson.ObjectIDFromHex(legacy.Report)
		return makeDocument("report.created:"+legacy.Report, legacy.User, legacy.Report, legacy.Scan, legacy.Message, id.Timestamp())
	}
	if string(raw["schema_version"]) != "1" || json.Unmarshal(body, &event) != nil || event.Version.String() != "1" || event.Kind != "report.created" || event.Data == nil {
		return Document{}, ErrInvalid
	}
	stamp, err := time.Parse(time.RFC3339Nano, event.Time)
	if err != nil {
		return Document{}, ErrInvalid
	}
	return makeDocument(event.ID, event.User, event.Data.Report, event.Data.Scan, event.Data.Message, stamp)
}
func makeDocument(id, user, report, scan, message string, stamp time.Time) (Document, error) {
	if !bounded(id, 256) || !bounded(user, 256) || !objectID.MatchString(report) || id != "report.created:"+report || !bounded(scan, 128) || !bounded(message, 2000) {
		return Document{}, ErrInvalid
	}
	stamp = stamp.UTC().Truncate(time.Microsecond)
	format := "2006-01-02T15:04:05"
	if stamp.Nanosecond() != 0 {
		format += ".000000"
	}
	return Document{ID: "event:" + id, EventID: id, EventType: "report.created", User: user, ReportID: report, ScanID: scan, Message: message, Timestamp: stamp.Format(format) + "+00:00"}, nil
}
