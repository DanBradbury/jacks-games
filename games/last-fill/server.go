// Run from the game directory after building the web client.
package main

import (
	"flag"
	"log"
	"net/http"
	"os"
	"time"
)

func main() {
	addr := flag.String("addr", "127.0.0.1:8080", "HTTP listen address")
	flag.Parse()
	if _, err := os.Stat("dist/index.html"); err != nil {
		log.Fatal("Build the scene first with npm run build")
	}
	server := &http.Server{
		Addr:              *addr,
		Handler:           http.FileServer(http.Dir("dist")),
		ReadHeaderTimeout: 5 * time.Second,
	}
	log.Printf("The Last Fill at http://%s", *addr)
	log.Fatal(server.ListenAndServe())
}
