package com.vollmoon.rackwise.web;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * Serves the built React app (in resources/static) for browser routes like /dashboard or /receipts,
 * so the whole product runs as one Spring Boot jar.
 */
@Controller
public class SpaController {
    @GetMapping({"/", "/{a:[\\w-]+}", "/{a:[\\w-]+}/{b:[\\w-]+}", "/{a:[\\w-]+}/{b:[\\w-]+}/{c:[\\w-]+}"})
    public String index() {
        return "forward:/index.html";
    }
}
