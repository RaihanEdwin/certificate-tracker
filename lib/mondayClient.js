const fetch = require("node-fetch");

class MondayClient {
  constructor() {
    this.apiUrl = "https://api.monday.com/v2";
    // Langsung ambil dari environment variables
    this.token =
      "eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjU0MDk4NDg1MSwiYWFpIjoxMSwidWlkIjo3NTkyMjE0OSwiaWFkIjoiMjAyNS0wNy0yMFQwNzo1NDo0Ny4wMDBaIiwicGVyIjoibWU6d3JpdGUiLCJhY3RpZCI6Mjk0NzM5OTYsInJnbiI6ImFwc2UyIn0.z8qBlugIsT21NMi5lKzw52OneFd6WxiR9hOoHM_9A7k";
    this.boardId = 2045297235;

    // Validasi token dan boardId
    if (!this.token) {
      throw new Error("MONDAY_API_TOKEN environment variable is required");
    }
    if (!this.boardId) {
      throw new Error("MONDAY_BOARD_ID environment variable is required");
    }

    console.log("MondayClient initialized");
    console.log("Board ID:", this.boardId);
    console.log("Token exists:", !!this.token);
  }

  async executeQuery(query, variables = {}) {
    try {
      console.log("Executing Monday.com query with variables:", variables);

      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: this.token, // Monday.com doesn't need Bearer prefix
        },
        body: JSON.stringify({
          query,
          variables,
        }),
      });

      console.log("Monday.com response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Monday.com HTTP Error:", errorText);
        throw new Error(
          `HTTP error! status: ${response.status}, message: ${errorText}`
        );
      }

      const data = await response.json();
      console.log("Monday.com response data:", JSON.stringify(data, null, 2));

      if (data.errors) {
        console.error("Monday.com API Errors:", data.errors);
        throw new Error(`Monday.com API error: ${JSON.stringify(data.errors)}`);
      }

      return data.data;
    } catch (error) {
      console.error("Monday.com API Error:", error);
      throw error;
    }
  }

  async getAllCertificates() {
    const query = `
      query GetBoardItems($boardId: ID!) {  
        boards(ids: [$boardId]) {
          id
          name
          columns {
            id
            title
            type
          }
          items_page(limit: 50) {  
            items {  
              id  
              name
              column_values {  
                id
                value
                text
                column {
                  id
                  title
                  type
                }
                ... on StatusValue {
                  text
                  index
                }
                ... on DateValue {
                  date
                  text
                }
                ... on LinkValue {
                  url
                  text
                }
                ... on TextValue {
                  text
                }
              }
              subitems {
                id
                name
                column_values {
                  id
                  value
                  text
                  column {
                    id
                    title
                    type
                  }
                  ... on StatusValue {
                    text
                    index
                  }
                  ... on DateValue {
                    date
                    text
                  }
                  ... on LinkValue {
                    url
                    text
                  }
                  ... on TextValue {
                    text
                  }
                }
              }
            }  
          }  
        }  
      }
    `;

    const variables = {
      boardId: this.boardId.toString(),
    };

    try {
      const result = await this.executeQuery(query, variables);

      // Enhanced logging
      console.log("=== MONDAY.COM DATA DEBUG ===");
      if (result.boards && result.boards[0]) {
        const board = result.boards[0];
        console.log("Board ID:", board.id);
        console.log("Board Name:", board.name);
        console.log(
          "Board Columns:",
          board.columns.map((col) => ({
            id: col.id,
            title: col.title,
            type: col.type,
          }))
        );

        if (board.items_page && board.items_page.items.length > 0) {
          console.log("Total Items:", board.items_page.items.length);

          const firstItem = board.items_page.items[0];
          console.log("First Item ID:", firstItem.id);
          console.log("First Item Name:", firstItem.name);
          console.log(
            "First Item Columns:",
            firstItem.column_values.map((col) => ({
              id: col.id,
              title: col.column?.title,
              type: col.column?.type,
              value: col.value,
              text: col.text,
            }))
          );

          if (firstItem.subitems && firstItem.subitems.length > 0) {
            console.log(
              "First Item has",
              firstItem.subitems.length,
              "subitems"
            );
            const firstSubitem = firstItem.subitems[0];
            console.log("First Subitem:", firstSubitem.name);
            console.log(
              "First Subitem Columns:",
              firstSubitem.column_values.map((col) => ({
                id: col.id,
                title: col.column?.title,
                type: col.column?.type,
                value: col.value,
                text: col.text,
              }))
            );
          }
        } else {
          console.log("No items found in board");
        }
      } else {
        console.log("No boards found or empty result");
      }
      console.log("=== END DEBUG ===");

      return result;
    } catch (error) {
      console.error("Error in getAllCertificates:", error);
      throw error;
    }
  }

  async searchCertificatesByName(searchTerm) {
    try {
      console.log("Searching for certificates with term:", searchTerm);

      const data = await this.getAllCertificates();
      const results = [];

      if (data.boards && data.boards[0] && data.boards[0].items_page) {
        const items = data.boards[0].items_page.items;

        items.forEach((item) => {
          // Check if item name matches search term
          if (item.name.toLowerCase().includes(searchTerm.toLowerCase())) {
            // If item has subitems (certificates)
            if (item.subitems && item.subitems.length > 0) {
              item.subitems.forEach((subitem) => {
                const certificate = this.processItemToCertificate(
                  subitem,
                  item.name
                );
                results.push(certificate);
              });
            } else {
              // If no subitems, process item directly
              const certificate = this.processItemToCertificate(
                item,
                item.name
              );
              results.push(certificate);
            }
          }
        });
      }

      console.log("Search results:", results.length, "certificates found");
      return results;
    } catch (error) {
      console.error("Error searching certificates:", error);
      throw error;
    }
  }

  processItemToCertificate(item, ownerName) {
    const certificate = {
      id: item.id,
      name: ownerName,
      subjectTitle: item.name || "-",
      date: "-",
      expiredDate: "-",
      status: "VALID",
      certificateLink: "#",
    };

    // Process column values
    if (item.column_values) {
      item.column_values.forEach((column) => {
        const columnTitle = column.column?.title || "";
        const columnType = column.column?.type || "";

        console.log(
          `Processing column: ${columnTitle} (${column.id}) type: ${columnType} = ${column.value} | ${column.text}`
        );

        // Mapping based on column title
        switch (columnTitle) {
          case "Expiry Date":
          case "Expired Date":
            certificate.expiredDate = this.extractDateValue(column);
            break;

          case "Status":
            certificate.status = this.extractStatusValue(column);
            break;

          case "Certificate":
          case "Certificate Link":
            certificate.certificateLink = this.extractLinkValue(column);
            break;

          case "Issue Date":
          case "Issued Date":
            certificate.date = this.extractDateValue(column);
            break;

          default:
            // Handle generic date columns
            if (
              columnTitle.toLowerCase().includes("date") &&
              certificate.date === "-"
            ) {
              certificate.date = this.extractDateValue(column);
            }
            // Handle generic link columns
            if (
              columnTitle.toLowerCase().includes("link") ||
              columnTitle.toLowerCase().includes("certificate")
            ) {
              if (certificate.certificateLink === "#") {
                certificate.certificateLink = this.extractLinkValue(column);
              }
            }
        }
      });
    }

    return certificate;
  }

  extractDateValue(column) {
    if (column.text && column.text !== "-") {
      return this.formatDate(column.text);
    }

    if (column.value) {
      try {
        const parsed = JSON.parse(column.value);
        if (parsed.date) {
          return this.formatDate(parsed.date);
        }
      } catch (e) {
        // If not JSON, try direct formatting
        return this.formatDate(column.value);
      }
    }

    return "-";
  }

  extractStatusValue(column) {
    if (column.text && column.text !== "-") {
      return column.text;
    }

    if (column.value) {
      try {
        const parsed = JSON.parse(column.value);
        return parsed.label || parsed.text || "VALID";
      } catch (e) {
        return column.value || "VALID";
      }
    }

    return "VALID";
  }

  extractLinkValue(column) {
    let url = "";

    if (column.text && column.text !== "-") {
      url = column.text;
    } else if (column.value) {
      try {
        const parsed = JSON.parse(column.value);
        url = parsed.url || parsed.text || "";
      } catch (e) {
        url = column.value || "";
      }
    }

    return this.cleanCertificateUrl(url);
  }

  cleanCertificateUrl(url) {
    if (!url || url === "-" || url === "#") return "#";

    // Remove localhost prefix if exists
    if (url.includes("localhost")) {
      const driveMatch = url.match(/https:\/\/drive\.google\.com\/[^\s]+/);
      if (driveMatch) {
        return driveMatch[0];
      }
    }

    // Extract Google Drive URL
    const driveMatch = url.match(/https:\/\/drive\.google\.com\/[^\s]+/);
    if (driveMatch) {
      return driveMatch[0];
    }

    // Return original URL if it's a valid HTTP URL
    if (url.startsWith("http")) {
      return url;
    }

    return "#";
  }

  formatDate(dateString) {
    if (!dateString || dateString === "-") return "-";

    try {
      let date;

      if (dateString.includes(",")) {
        // Format: "Fri, May 15, 2026"
        date = new Date(dateString);
      } else if (dateString.includes("-")) {
        // Format: "2026-05-15"
        date = new Date(dateString);
      } else {
        date = new Date(dateString);
      }

      if (isNaN(date.getTime())) {
        return dateString; // Return original if parsing fails
      }

      return date.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch (e) {
      console.error("Date formatting error:", e);
      return dateString;
    }
  }
}

module.exports = MondayClient;
