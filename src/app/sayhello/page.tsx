"use client";

import { useState } from "react";
import { Button } from "@chakra-ui/react";
import { Box, Text, VStack, Spinner } from "@chakra-ui/react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../../amplify/data/resource";
import { Amplify } from "aws-amplify";
import outputs from "@/../amplify_outputs.json";

Amplify.configure(outputs);

const client = generateClient<Schema>();

export default function SayHello() {
  const [responseText, setResponseText] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const handleClick = async () => {
    setLoading(true);
    setError("");
    
    try {
      const { data, errors } = await client.queries.sayHello({
        name: "World",
      });

      if (errors) {
        setError(errors.map((e: { message: string }) => e.message).join(", "));
      } else if (data) {
        setResponseText(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      minH="100vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      p={8}
    >
      <VStack gap={6} align="center">
        <Button
          onClick={handleClick}
          colorScheme="blue"
          size="lg"
          px={8}
          py={6}
          disabled={loading}
        >
          {loading ? <Spinner size="sm" /> : "Say Hello"}
        </Button>

        {error && (
          <Box
            p={6}
            bg="red.100"
            borderRadius="md"
            maxW="500px"
            textAlign="center"
            _dark={{ bg: "red.900" }}
          >
            <Text fontSize="lg" color="red.700" _dark={{ color: "red.200" }}>
              Error: {error}
            </Text>
          </Box>
        )}

        {responseText && !error && (
          <Box
            p={6}
            bg="gray.100"
            borderRadius="md"
            maxW="500px"
            textAlign="center"
            _dark={{ bg: "gray.800" }}
          >
            <Text fontSize="lg">{responseText}</Text>
          </Box>
        )}
      </VStack>
    </Box>
  );
}

