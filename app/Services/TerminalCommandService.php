<?php

namespace App\Services;

class TerminalCommandService
{
    /**
     * @return array<int, string>
     */
    public function run(string $command): array
    {
        return match (strtolower(trim($command))) {
            'help' => ['Commands: help, about, projects, experience, stack, contact, clear, salem, whoami'],
            'about', 'whoami' => ['Caique Rechi', 'Backend-focused full-stack developer from Londrina, Brazil.'],
            'projects' => ['IMS', 'BudgetCore', 'Payment Flow'],
            'experience' => ['2019 Junior Developer', '2021 Backend Developer', '2023 Backend Engineer'],
            'stack' => ['PHP, Laravel, MySQL, Redis, React, TypeScript, Docker, PHPUnit'],
            'contact' => ['Use the Contact app or email contato@caiquerechi.dev.'],
            'salem' => ['Salem is awake. Probably judging the deployment checklist.'],
            'clear' => [],
            default => ['Command not allowed. Type help.'],
        };
    }
}
