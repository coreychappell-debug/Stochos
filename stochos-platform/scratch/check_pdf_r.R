# Check R packages
packages <- c("pdftools", "readr", "xml2")
for (pkg in packages) {
  res <- require(pkg, character.only = TRUE, quietly = TRUE)
  cat(paste0(pkg, ": ", ifelse(res, "AVAILABLE", "NOT AVAILABLE"), "\n"))
}
